"use client";

import type { AssistantAction, AssistantMessage, AssistantMessagesResponse } from "@marketos/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyAction, applyProgress, clearMessages, fetchMessages, markAction, sendMessage } from "@/lib/assistant-api";
import { notify } from "@/lib/notify/notify";
import { keys } from "@/lib/queries";

type History = InfiniteData<AssistantMessagesResponse, string | undefined>;
export const assistantKey = (projectId: string) => ["assistant", projectId] as const;

/** Thay một tin trong lịch sử đã tải (sau khi Apply/Dismiss đổi trạng thái action). */
const replaceMessage = (data: History | undefined, message: AssistantMessage): History | undefined =>
  data && { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((m) => (m.id === message.id ? message : m)) })) };

/** Lịch sử chat của dự án (server trả mới nhất trước; ở đây đảo lại cũ → mới) và gửi tin có stream. */
export function useAssistant(projectId: string) {
  const qc = useQueryClient();
  const key = assistantKey(projectId);
  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchMessages(projectId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
  });
  const messages = useMemo(() => (history.data?.pages.flatMap((p) => p.items) ?? []).toReversed(), [history.data]);

  // Tin đang gửi: hiện ngay câu hỏi và câu trả lời đang stream, tới khi có `done`.
  const [pending, setPending] = useState<{ content: string; reply: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (content: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setError(null);
      setPending({ content, reply: "" });
      try {
        const done = await sendMessage(projectId, content, { signal: controller.signal, onDelta: (t) => setPending((p) => p && { ...p, reply: p.reply + t }) });
        qc.setQueryData<History>(key, (d) => d && { ...d, pages: d.pages.map((p, i) => (i === 0 ? { ...p, items: [done.assistantMessage, done.userMessage, ...p.items] } : p)) });
      } catch (e) {
        if (!(controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError"))) {
          setError(e);
          notify.apiError("The assistant couldn't reply", e);
        }
        // Tin của người dùng vẫn được lưu ở server khi lỗi/huỷ: tải lại để lịch sử khớp.
        void qc.invalidateQueries({ queryKey: key });
      } finally {
        if (abort.current === controller) setPending(null);
        void qc.invalidateQueries({ queryKey: keys.usage });
      }
    },
    [projectId, qc, key],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const clear = useMutation({
    mutationFn: async () => {
      abort.current?.abort();
      await clearMessages(projectId);
    },
    onSuccess: () => {
      notify.success("Chat cleared");
      return qc.resetQueries({ queryKey: key });
    },
  });

  return { history, messages, pending, error, send, stop, clear, isSending: !!pending };
}

const APPLIED: Record<AssistantAction["type"], Parameters<typeof notify.success>> = {
  create_draft: ["Draft saved", { description: "It's in Needs review.", action: { label: "Open Content Studio", appId: "content-studio" } }],
  edit_content: ["Post updated", { action: { label: "Open Content Studio", appId: "content-studio" } }],
  schedule: ["Post scheduled", { action: { label: "Open calendar", appId: "content-calendar" } }],
  update_brief: ["Brand Brief updated", { action: { label: "Open Brand Brief", appId: "brand-brief" } }],
  generate_image: ["Image created", { description: "It's in the Media Library.", action: { label: "Open Media Library", appId: "media-library" } }],
  attach_media: ["Images added to the post", { action: { label: "Open Content Studio", appId: "content-studio" } }],
};

export const applyKey = (projectId: string, messageId: string, actionId: string) => ["assistant-apply", projectId, messageId, actionId] as const;

/**
 * Apply do backend thực hiện và lưu tiến độ. Action còn `proposed` đọc tiến độ đã lưu để khôi phục sau reload;
 * lỗi thì đọc lại tiến độ (không gọi Apply lần nữa) để hiện phần đã xong. Gọi lại cùng message/action không tạo trùng.
 */
export function useAction(projectId: string, messageId: string, action: AssistantAction) {
  const qc = useQueryClient();
  const key = applyKey(projectId, messageId, action.id);
  const progress = useQuery({ queryKey: key, queryFn: () => applyProgress(projectId, messageId, action.id), enabled: action.status === "proposed", staleTime: Infinity });
  // Apply có thể đổi bài, lịch, brief, thư viện ảnh / ảnh của bài và lượt ảnh AI.
  const refresh = () =>
    void Promise.all(
      [assistantKey(projectId), keys.contents(projectId), keys.brief(projectId), ["assets", projectId], ["content-assets", projectId], keys.usage].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
  const apply = useMutation({
    meta: { silent: true },
    mutationFn: () => applyAction(projectId, messageId, action.id),
    onSuccess: (result) => {
      qc.setQueryData(key, result);
      refresh();
      if (result.status === "applied") notify.success(...APPLIED[action.type]);
    },
    onError: () => {
      // Có thể một phần đã xong (bài/ảnh đã tạo): đọc tiến độ và làm mới dữ liệu liên quan.
      void qc.invalidateQueries({ queryKey: key });
      refresh();
    },
  });
  const dismiss = useMutation({
    meta: { silent: true },
    mutationFn: () => markAction(projectId, messageId, action.id, "dismissed"),
    onSuccess: (message) => qc.setQueryData<History>(assistantKey(projectId), (d) => replaceMessage(d, message)),
  });
  return { progress, apply, dismiss };
}
