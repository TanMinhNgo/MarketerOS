"use client";

import type { ContentResponse } from "@marketos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchCalendarItems, updateSchedule, type SchedulePatch } from "../../lib/calendar-api";

/** Khoá nằm dưới ["contents", projectId] nên lưu/xoá nháp ở Content Studio tự làm mới lịch. */
export const calendarKey = (projectId: string) => ["contents", projectId, "calendar"] as const;

export const useCalendarItems = (projectId: string) => useQuery({ queryKey: calendarKey(projectId), queryFn: () => fetchCalendarItems(projectId) });

/** Đổi lịch/trạng thái: cập nhật ngay trên màn hình (optimistic), lỗi thì hoàn lại bản cũ. */
export function useReschedule(projectId: string) {
  const qc = useQueryClient();
  const key = calendarKey(projectId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SchedulePatch }) => updateSchedule(projectId, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ContentResponse[]>(key);
      qc.setQueryData<ContentResponse[]>(key, (items) => items?.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error("Couldn't update the schedule. Your change was undone.");
    },
  });
}
