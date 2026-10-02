"use client";

import type { GenerateContentInput, GeneratedVariant } from "@marketos/shared";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "../../lib/api-client";
import { streamGenerate, streamRegenerate, type GenerateEvent } from "../../lib/generate";

export interface VariantState {
  data: Partial<GeneratedVariant>;
  /** Biến thể đã nhận đủ và có thể chỉnh sửa. */
  done: boolean;
  /** Generation tạo ra biến thể này (tạo lại một biến thể sinh Generation mới); dùng khi lưu nháp. */
  generationId: string | null;
  /** Tăng mỗi lần tạo lại; dùng làm key để thẻ dựng lại sạch. */
  rev: number;
}

export interface GenerationState {
  status: "idle" | "streaming" | "done" | "stopped" | "error";
  variants: VariantState[];
  /** Input của lần tạo gần nhất, dùng lại khi tạo lại một biến thể. */
  input: GenerateContentInput | null;
  error: unknown;
  /** Tăng mỗi lần bắt đầu tạo; dùng làm key để các thẻ dựng lại sạch. */
  run: number;
}

const blank = (): VariantState[] => [0, 1, 2].map(() => ({ data: {}, done: false, generationId: null, rev: 0 }));
export const initialGeneration: GenerationState = { status: "idle", variants: [], input: null, error: null, run: 0 };

type Action =
  | { type: "start"; input: GenerateContentInput }
  | { type: "event"; event: GenerateEvent; index?: number }
  | { type: "stop" }
  | { type: "fail"; error: unknown }
  | { type: "finish" }
  | { type: "reset" }
  | { type: "regen-start"; index: number }
  | { type: "regen-restore"; index: number; prev: VariantState };

const setAt = (s: GenerationState, index: number, f: (v: VariantState) => VariantState): GenerationState => ({ ...s, variants: s.variants.map((v, i) => (i === index ? f(v) : v)) });

export function generationReducer(s: GenerationState, a: Action): GenerationState {
  switch (a.type) {
    case "start":
      return { status: "streaming", variants: blank(), input: a.input, error: null, run: s.run + 1 };
    case "event": {
      const e = a.event;
      if (e.type === "delta") return setAt(s, e.index, (v) => ({ ...v, data: { ...v.data, ...e.variant } }));
      if (e.type === "variant") return setAt(s, e.index, (v) => ({ ...v, data: e.variant, done: true }));
      // `done` của lần tạo lại chỉ có một biến thể, nằm ở `a.index`.
      if (a.index !== undefined) return setAt(s, a.index, (v) => ({ ...v, data: e.variants[0], done: true, generationId: e.generationId }));
      return { ...s, variants: e.variants.map((data, i) => ({ data, done: true, generationId: e.generationId, rev: s.variants[i]?.rev ?? 0 })) };
    }
    case "stop":
      return { ...s, status: "stopped" };
    case "fail":
      return { ...s, status: "error", error: a.error };
    case "finish":
      return s.status === "streaming" ? { ...s, status: "done" } : s;
    case "reset":
      return { ...initialGeneration, run: s.run };
    case "regen-start":
      return setAt(s, a.index, (v) => ({ data: {}, done: false, generationId: null, rev: v.rev + 1 }));
    case "regen-restore":
      return setAt(s, a.index, (v) => ({ ...a.prev, rev: v.rev + 1 }));
  }
}

const isAbort = (e: unknown, c: AbortController) => c.signal.aborted || (e instanceof DOMException && e.name === "AbortError");

/** Quản lý một lần tạo nội dung: stream từng biến thể, tạo lại từng biến thể, dừng được, huỷ khi đóng cửa sổ. */
export function useGeneration(projectId: string) {
  const [state, dispatch] = useReducer(generationReducer, initialGeneration);
  const abort = useRef<AbortController | null>(null);
  const regens = useRef(new Map<number, AbortController>());

  const abortAll = useCallback(() => {
    abort.current?.abort();
    regens.current.forEach((c) => c.abort());
    regens.current.clear();
  }, []);

  useEffect(() => abortAll, [abortAll]);
  useEffect(() => {
    abortAll();
    dispatch({ type: "reset" });
  }, [projectId, abortAll]);

  const generate = useCallback(
    async (input: GenerateContentInput) => {
      abortAll();
      const controller = new AbortController();
      abort.current = controller;
      dispatch({ type: "start", input });
      try {
        await streamGenerate(projectId, input, { signal: controller.signal, onEvent: (event) => dispatch({ type: "event", event }) });
        if (!controller.signal.aborted) dispatch({ type: "finish" });
      } catch (error) {
        if (isAbort(error, controller)) return;
        dispatch({ type: "fail", error });
      }
    },
    [projectId, abortAll],
  );

  /** Tạo lại biến thể `index`; lỗi thì trả lại biến thể cũ và ném lỗi cho nơi gọi báo người dùng. */
  const regenerate = useCallback(
    async (index: number) => {
      const prev = state.variants[index];
      if (!state.input || !prev?.done) return;
      const others = state.variants.filter((v, i) => i !== index && v.done).map((v) => v.data as GeneratedVariant);
      const controller = new AbortController();
      regens.current.set(index, controller);
      dispatch({ type: "regen-start", index });
      try {
        await streamRegenerate(projectId, { input: state.input, others, index: index as 0 | 1 | 2 }, { signal: controller.signal, onEvent: (event) => dispatch({ type: "event", event, index }) });
      } catch (error) {
        if (isAbort(error, controller)) return;
        dispatch({ type: "regen-restore", index, prev });
        throw error;
      } finally {
        if (regens.current.get(index) === controller) regens.current.delete(index);
      }
    },
    [projectId, state.input, state.variants],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: "stop" });
  }, []);

  return { state, generate, regenerate, stop, isStreaming: state.status === "streaming" };
}

export const isQuotaError = (e: unknown) => e instanceof ApiError && e.code === "QUOTA_EXCEEDED";
