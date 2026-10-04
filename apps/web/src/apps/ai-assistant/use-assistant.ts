"use client";

import type { AssistantAction, AssistantMessage, AssistantMessagesResponse } from "@marketos/shared";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyAction, clearMessages, fetchMessages, markAction, sendMessage } from "@/lib/assistant-api";
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

/** Hành động đã chạy nhưng không lưu được nhãn `applied`: không cho bấm Apply lại (tránh tạo trùng). */
export class AppliedButNotMarked extends Error {}

/** Apply: chạy hành động bằng API sẵn có rồi mới đánh dấu `applied`; lỗi thì action vẫn `proposed`. */
export function useActionStatus(projectId: string, messageId: string) {
  const qc = useQueryClient();
  // Apply có thể đổi bài, brief, thư viện ảnh / ảnh của bài và lượt ảnh AI.
  const refreshTargets = () =>
    void Promise.all(
      [keys.contents(projectId), keys.brief(projectId), ["assets", projectId], ["content-assets", projectId], keys.usage].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({ action, status }: { action: AssistantAction; status: "applied" | "dismissed" }) => {
      if (status === "applied") await applyAction(projectId, action);
      try {
        return await markAction(projectId, messageId, action.id, status);
      } catch (e) {
        if (status === "applied") throw new AppliedButNotMarked("Applied, but the chat couldn't record it.");
        throw e;
      }
    },
    onSuccess: (message, { action, status }) => {
      qc.setQueryData<History>(assistantKey(projectId), (d) => replaceMessage(d, message));
      if (status === "applied") {
        refreshTargets();
        notify.success(...APPLIED[action.type]);
      }
    },
    onError: (e) => {
      if (e instanceof AppliedButNotMarked) {
        refreshTargets();
        notify.warning("Applied, but not marked", { description: e.message });
      } else notify.apiError("Couldn't apply the suggestion", e);
    },
  });
}
