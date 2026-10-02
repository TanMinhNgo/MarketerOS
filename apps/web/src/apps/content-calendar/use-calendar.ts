"use client";

import type { ContentResponse } from "@marketos/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRange, fetchUnscheduled, updateSchedule, type SchedulePatch } from "../../lib/calendar-api";

/** Khoá nằm dưới ["contents", projectId] nên lưu/xoá/duyệt nháp ở Content Studio tự làm mới lịch. */
export const calendarKey = (projectId: string) => ["contents", projectId, "calendar"] as const;

/** Nội dung có lịch trong [from, to); đổi tháng/tuần vẫn giữ dữ liệu cũ tới khi có dữ liệu mới. */
export const useCalendarRange = (projectId: string, from: Date, to: Date, enabled = true) =>
  useQuery({
    queryKey: [...calendarKey(projectId), "range", from.toISOString(), to.toISOString()],
    queryFn: () => fetchRange(projectId, from, to),
    enabled: enabled && !!projectId,
    placeholderData: keepPreviousData,
  });

export const useUnscheduled = (projectId: string) => useQuery({ queryKey: [...calendarKey(projectId), "unscheduled"], queryFn: () => fetchUnscheduled(projectId) });

/**
 * Đổi lịch/trạng thái: cập nhật ngay mọi danh sách lịch đang có (optimistic), lỗi thì hoàn lại bản cũ
 * (thông báo lỗi do MutationCache chung hiển thị). Xong thì lấy lại dữ liệu thật từ server.
 */
export function useReschedule(projectId: string) {
  const qc = useQueryClient();
  const key = calendarKey(projectId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SchedulePatch }) => updateSchedule(projectId, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueriesData<ContentResponse[]>({ queryKey: key });
      // READY/DRAFT không giữ lịch khi đổi trạng thái (backend xoá scheduledAt).
      const cleared = patch.status === "READY" || patch.status === "DRAFT" ? { scheduledAt: null } : {};
      qc.setQueriesData<ContentResponse[]>({ queryKey: key }, (items) => items?.map((i) => (i.id === id ? { ...i, ...patch, ...cleared, updatedAt: new Date().toISOString() } : i)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev.forEach(([k, data]) => qc.setQueryData(k, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["contents", projectId] }),
  });
}
