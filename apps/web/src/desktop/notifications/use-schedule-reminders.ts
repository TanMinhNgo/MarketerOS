"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useCalendarRange } from "@/apps/content-calendar/use-calendar";
import { addDays } from "@/lib/calendar-utils";
import { useNotifications } from "@/lib/notify/notification-store";
import { notify } from "@/lib/notify/notify";
import { planReminders } from "@/lib/notify/reminders";
import { useActiveProject } from "@/stores/active-project";

const DAY = 24 * 60 * 60_000;

/**
 * Nhắc lịch đăng bài cho dự án đang chọn. Không kiểm tra liên tục: chỉ đặt một hẹn giờ tới mốc nhắc
 * gần nhất, tính lại khi lịch thay đổi.
 */
export function useScheduleReminders() {
  const { isSignedIn } = useAuth();
  const projectId = useActiveProject((s) => s.activeId);
  const enabled = useNotifications((s) => s.prefs.reminders) && !!isSignedIn && !!projectId;
  const [wake, setWake] = useState(0);
  // Hôm qua (bài vừa quá giờ sau nửa đêm) tới hết ngày mai; khoá theo ngày nên lần đánh thức lúc nửa đêm tự tải khoảng mới.
  const today = addDays(new Date(), 0);
  const { data } = useCalendarRange(projectId ?? "", addDays(today, -1), addDays(today, 2), enabled);

  useEffect(() => {
    if (!enabled || !data || !projectId) return;
    const store = useNotifications.getState();
    const { due, nextAt } = planReminders(projectId, data, new Date(), new Set(store.fired));
    for (const r of due) {
      if (!store.markFired(r.key)) continue;
      notify.reminder(r.title, { description: r.description, action: { label: "Open calendar", appId: "content-calendar" }, persist: true, os: true });
    }
    if (nextAt === null) return;
    const timer = setTimeout(() => setWake((n) => n + 1), Math.min(Math.max(nextAt - Date.now(), 1000), DAY));
    return () => clearTimeout(timer);
  }, [enabled, data, projectId, wake]);
}
