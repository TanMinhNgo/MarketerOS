"use client";

import type { GenerateContentInput, GeneratedVariant } from "@marketos/shared";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "../../lib/api-client";
import { streamGenerate, type GenerateEvent } from "../../lib/generate";

export interface VariantState {
  data: Partial<GeneratedVariant>;
  /** Biến thể đã nhận đủ và có thể chỉnh sửa. */
  done: boolean;
}

export interface GenerationState {
  status: "idle" | "streaming" | "done" | "stopped" | "error";
  variants: VariantState[];
  generationId: string | null;
  error: unknown;
  /** Tăng mỗi lần bắt đầu tạo; dùng làm key để các thẻ dựng lại sạch. */
  run: number;
}

const blank = (): VariantState[] => [0, 1, 2].map(() => ({ data: {}, done: false }));
export const initialGeneration: GenerationState = { status: "idle", variants: [], generationId: null, error: null, run: 0 };

type Action = { type: "start" } | { type: "event"; event: GenerateEvent } | { type: "stop" } | { type: "fail"; error: unknown } | { type: "finish" } | { type: "reset" };

export function generationReducer(s: GenerationState, a: Action): GenerationState {
  switch (a.type) {
    case "start":
      return { status: "streaming", variants: blank(), generationId: null, error: null, run: s.run + 1 };
    case "event": {
      const e = a.event;
      if (e.type === "delta") return { ...s, variants: s.variants.map((v, i) => (i === e.index ? { ...v, data: { ...v.data, ...e.variant } } : v)) };
      if (e.type === "variant") return { ...s, variants: s.variants.map((v, i) => (i === e.index ? { data: e.variant, done: true } : v)) };
      return { ...s, generationId: e.generationId, variants: e.variants.map((data) => ({ data, done: true })) };
    }
    case "stop":
      return { ...s, status: "stopped" };
    case "fail":
      return { ...s, status: "error", error: a.error };
    case "finish":
      return s.status === "streaming" ? { ...s, status: "done" } : s;
    case "reset":
      return { ...initialGeneration, run: s.run };
  }
}

/** Quản lý một lần tạo nội dung: stream từng biến thể, dừng được, huỷ khi đóng cửa sổ. */
export function useGeneration(projectId: string) {
  const [state, dispatch] = useReducer(generationReducer, initialGeneration);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    abort.current?.abort();
    dispatch({ type: "reset" });
  }, [projectId]);

  const generate = useCallback(
    async (input: GenerateContentInput) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      dispatch({ type: "start" });
      try {
        await streamGenerate(projectId, input, { signal: controller.signal, onEvent: (event) => dispatch({ type: "event", event }) });
        if (!controller.signal.aborted) dispatch({ type: "finish" });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        dispatch({ type: "fail", error });
      }
    },
    [projectId],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: "stop" });
  }, []);

  return { state, generate, stop, isStreaming: state.status === "streaming" };
}

export const isQuotaError = (e: unknown) => e instanceof ApiError && e.code === "QUOTA_EXCEEDED";
