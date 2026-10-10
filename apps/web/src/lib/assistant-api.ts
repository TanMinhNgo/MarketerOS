import {
  AssistantApplyResponseSchema,
  AssistantDoneSchema,
  AssistantMessageDeltaSchema,
  AssistantMessageSchema,
  AssistantMessagesResponseSchema,
  type AssistantDone,
} from "@marketos/shared";
import { api, ApiError, request } from "./api-client";
import { postSse } from "./generate";

const base = (projectId: string) => `/api/projects/${projectId}/assistant/messages`;

/** Một trang lịch sử, mới nhất trước; `before` là id tin nhắn cuối của trang trước. */
export function fetchMessages(projectId: string, before?: string) {
  const q = new URLSearchParams({ limit: "30" });
  if (before) q.set("before", before);
  return api(`${base(projectId)}?${q}`, AssistantMessagesResponseSchema);
}

/** Gửi một tin và stream câu trả lời; `onDelta` nhận đoạn chữ nối thêm, kết quả chính thức là sự kiện `done`. */
export async function sendMessage(projectId: string, content: string, { signal, onDelta }: { signal?: AbortSignal; onDelta: (text: string) => void }): Promise<AssistantDone> {
  let done: AssistantDone | null = null;
  await postSse(base(projectId), { content }, signal, (event, payload) => {
    if (event === "message.delta") {
      const p = AssistantMessageDeltaSchema.safeParse(payload);
      if (p.success) onDelta(p.data.text);
    } else if (event === "done") {
      const p = AssistantDoneSchema.safeParse(payload);
      if (p.success) done = p.data;
    }
  });
  if (!done) throw new ApiError(502, "SERVICE_UNAVAILABLE", "The reply ended before it finished. Please try again.");
  return done;
}

export const clearMessages = (projectId: string) => request(base(projectId), { method: "DELETE" });

export const markAction = (projectId: string, messageId: string, actionId: string, status: "applied" | "dismissed") =>
  api(`${base(projectId)}/${messageId}/actions/${actionId}`, AssistantMessageSchema, { method: "PATCH", body: { status } });

const applyPath = (projectId: string, messageId: string, actionId: string) => `${base(projectId)}/${messageId}/actions/${actionId}/apply`;

/** Backend thực hiện Apply và lưu tiến độ theo (messageId, actionId): gọi lại không tạo trùng bài/ảnh. */
export const applyAction = (projectId: string, messageId: string, actionId: string) =>
  api(applyPath(projectId, messageId, actionId), AssistantApplyResponseSchema, { method: "POST" });

/** Tiến độ Apply đã lưu (pending / running / partial / applied) để khôi phục sau reload hoặc mất kết nối. */
export const applyProgress = (projectId: string, messageId: string, actionId: string) => api(applyPath(projectId, messageId, actionId), AssistantApplyResponseSchema);
