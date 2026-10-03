"use client";

import {
  AutomationRunSchema,
  AutomationRunsResponseSchema,
  AutomationSchema,
  AutomationsResponseSchema,
  type AutomationRun,
  type AutomationRunsResponse,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from "@marketos/shared";
import { useInfiniteQuery, type InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, request } from "@/lib/api-client";
import { keys } from "@/lib/queries";
import { notify } from "@/lib/notify/notify";
import { assistantKey } from "../ai-assistant/use-assistant";

const base = (projectId: string) => `/api/projects/${projectId}/automations`;
const listKey = (projectId: string) => ["automations", projectId] as const;
const runsKey = (projectId: string, id: string) => ["automations", projectId, id, "runs"] as const;

export const useAutomations = (projectId: string) =>
  useQuery({ queryKey: listKey(projectId), queryFn: () => api(base(projectId), AutomationsResponseSchema) });

/** Sau mọi thay đổi: tải lại danh sách (nextRunAt do backend tính) và số tác vụ đang bật / lượt chạy. */
function useRefresh(projectId: string) {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: listKey(projectId) }), qc.invalidateQueries({ queryKey: keys.usage })]);
}

export function useSaveAutomation(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    meta: { silent: true },
    mutationFn: ({ id, input }: { id?: string; input: CreateAutomationInput | UpdateAutomationInput }) =>
      id
        ? api(`${base(projectId)}/${id}`, AutomationSchema, { method: "PATCH", body: input })
        : api(base(projectId), AutomationSchema, { method: "POST", body: input }),
    onSuccess: refresh,
  });
}

export function useDeleteAutomation(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    meta: { silent: true },
    mutationFn: (id: string) => request(`${base(projectId)}/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useRunNow(projectId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: async () => {
      const res = await request(`${base(projectId)}/${id}/run`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      return AutomationRunSchema.parse(await res.json());
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: runsKey(projectId, id) }), qc.invalidateQueries({ queryKey: keys.usage })]),
  });
}

function notifyRun(r: AutomationRun) {
  const opts = { description: r.summary ?? undefined, persist: true, os: true, appId: "automations" };
  if (r.status === "failed") return notify.error("Automation run failed", { ...opts, description: r.error?.message ?? opts.description });
  if (r.status === "skipped") return notify.warning("Automation run skipped", opts);
  const action = r.createdContentIds.length
    ? { label: "Review drafts", appId: "content-studio" }
    : r.scheduledContentIds.length
      ? { label: "Open calendar", appId: "content-calendar" }
      : r.assistantMessageId
        ? { label: "Open chat", appId: "ai-assistant" }
        : undefined;
  notify.success("Automation run finished", { ...opts, action });
}

/** Lịch sử chạy, mới nhất trước. Còn lần đang chờ/chạy thì poll 5 giây (backend chưa có realtime). */
export function useRuns(projectId: string, id: string) {
  const qc = useQueryClient();
  return useInfiniteQuery({
    queryKey: runsKey(projectId, id),
    queryFn: async ({ pageParam }) => {
      const q = new URLSearchParams({ limit: "10" });
      if (pageParam) q.set("before", pageParam);
      const page = await api(`${base(projectId)}/${id}/runs?${q}`, AutomationRunsResponseSchema);
      // Run vừa xong kể từ lần poll trước: báo kết quả, và làm mới bài / tin chat / lastRunAt mà nó có thể đã đổi.
      const before = qc.getQueryData<InfiniteData<AutomationRunsResponse>>(runsKey(projectId, id))?.pages[0]?.items;
      const done = pageParam ? [] : page.items.filter((r) => r.finishedAt && before?.some((b) => b.id === r.id && !b.finishedAt));
      done.forEach(notifyRun);
      if (done.length)
        void Promise.all(
          [keys.contents(projectId), listKey(projectId), assistantKey(projectId)].map((queryKey) => qc.invalidateQueries({ queryKey })),
        );
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
    refetchInterval: (q) => (q.state.data?.pages[0]?.items.some((r) => r.status === "queued" || r.status === "running") ? 5000 : false),
  });
}
