import {
  ApiErrorSchema,
  GenerationDoneSchema,
  SingleVariantDoneSchema,
  VariantDeltaSchema,
  VariantDoneSchema,
  type GenerateContentInput,
  type GeneratedVariant,
  type GenerateVariantInput,
} from "@marketos/shared";
import type { z } from "zod";
import { ApiError, request } from "./api-client";
import { createSseParser } from "./sse";

export type GenerateEvent =
  | { type: "delta"; index: number; variant: Partial<GeneratedVariant> }
  | { type: "variant"; index: number; variant: GeneratedVariant }
  | { type: "done"; generationId: string; variants: GeneratedVariant[] };

/**
 * Tạo nội dung bằng AI qua SSE. Dùng fetch + ReadableStream (không dùng EventSource vì cần POST và Bearer).
 * Lỗi trước khi stream (400/401/404/409/429/503) ném ApiError từ request(); lỗi giữa chừng
 * (sự kiện `error`) cũng ném ApiError. Huỷ bằng AbortSignal thì ném AbortError.
 */
export const streamGenerate = (projectId: string, input: GenerateContentInput, opts: StreamOptions) => streamSse(`/api/projects/${projectId}/generate`, input, GenerationDoneSchema, opts);

/** Tạo lại một biến thể (`index`), viết khác các biến thể `others` đang giữ. Sự kiện `done` chỉ có 1 biến thể. */
export const streamRegenerate = (projectId: string, body: GenerateVariantInput, opts: StreamOptions) => streamSse(`/api/projects/${projectId}/generate/variant`, body, SingleVariantDoneSchema, opts);

type StreamOptions = { signal?: AbortSignal; onEvent: (e: GenerateEvent) => void };

async function streamSse(path: string, body: unknown, doneSchema: z.ZodType<{ generationId: string; variants: GeneratedVariant[] }>, { signal, onEvent }: StreamOptions): Promise<void> {
  await postSse(path, body, signal, (event, payload) => {
    if (event === "variant.delta") {
      const p = VariantDeltaSchema.safeParse(payload);
      if (p.success) onEvent({ type: "delta", ...p.data });
    } else if (event === "variant.done") {
      const p = VariantDoneSchema.safeParse(payload);
      if (p.success) onEvent({ type: "variant", ...p.data });
    } else if (event === "done") {
      const p = doneSchema.safeParse(payload);
      if (p.success) onEvent({ type: "done", ...p.data });
    }
  });
}

/**
 * POST rồi đọc SSE (fetch + ReadableStream, Bearer, `Idempotency-Key` UUID mới mỗi lần), gọi `onEvent` với JSON
 * đã parse của từng sự kiện. Lỗi trước stream ném ApiError từ request(); sự kiện `error` giữa chừng cũng ném ApiError.
 * Huỷ bằng AbortSignal thì ném AbortError.
 */
export async function postSse(path: string, body: unknown, signal: AbortSignal | undefined, onEvent: (event: string, payload: unknown) => void): Promise<void> {
  const res = await request(path, {
    method: "POST",
    body,
    signal,
    headers: { "Idempotency-Key": crypto.randomUUID(), Accept: "text/event-stream" },
  });
  if (!res.body) throw new ApiError(502, "SERVICE_UNAVAILABLE", "The server sent an empty response.");

  let failure: ApiError | null = null;
  const feed = createSseParser(({ event, data }) => {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return; // mảnh hỏng thì bỏ qua, sự kiện `done` vẫn cho dữ liệu đầy đủ
    }
    if (event === "error") {
      const p = ApiErrorSchema.safeParse(payload);
      failure = p.success ? new ApiError(200, p.data.code, p.data.message, p.data.details) : new ApiError(200, "INTERNAL", "Generation failed.");
    } else onEvent(event, payload);
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    feed(decoder.decode(value, { stream: true }));
    if (failure) {
      await reader.cancel().catch(() => {});
      throw failure;
    }
  }
  feed(decoder.decode());
  if (failure) throw failure;
}
