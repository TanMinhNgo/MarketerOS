"use client";

import { useAuth } from "@clerk/nextjs";
import { OperationalAlertsResponseSchema } from "@marketos/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { z } from "zod";
import { api } from "@/lib/api-client";
import { useNotifications } from "@/lib/notify/notification-store";
import { notify } from "@/lib/notify/notify";
import { useActiveProject } from "@/stores/active-project";

type AlertType = z.infer<typeof OperationalAlertsResponseSchema>["items"][number]["type"];

const TEXT: Record<AlertType, { title: string; description: string; appId: string }> = {
  PUBLICATION_FAILED: { title: "A post couldn't be published", description: "Check the reason on the post before trying again.", appId: "integrations" },
  CONNECTION_REAUTH: { title: "A channel needs to be reconnected", description: "Open Integrations and press Reconnect.", appId: "integrations" },
  PUBLICATION_DELAYED: { title: "A post is taking long to publish", description: "Check the account; it may already be posted.", appId: "integrations" },
  CONTENT_DELAYED: { title: "A scheduled post hasn't gone out", description: "It's past its time and hasn't started publishing.", appId: "content-calendar" },
  AUTOMATION_FAILED: { title: "An automation run failed", description: "Open its History to see what happened.", appId: "automations" },
  AUTOMATION_DELAYED: { title: "An automation run is taking long", description: "Open its History to check on it.", appId: "automations" },
};

/**
 * Cảnh báo vận hành của dự án đang chọn: poll mỗi phút khi tab đang hiện (react-query dừng khi tab ẩn),
 * dừng poll khi request lỗi. Mỗi cảnh báo báo một lần (khoá theo id), mục trong chuông tự gỡ khi sự cố đã hết.
 */
export function useOperationalAlerts() {
  const { isSignedIn, userId } = useAuth();
  const projectId = useActiveProject((s) => s.activeId);
  const { data } = useQuery({
    queryKey: ["alerts", userId, projectId],
    queryFn: () => api(`/api/projects/${projectId}/alerts`, OperationalAlertsResponseSchema),
    enabled: !!isSignedIn && !!projectId,
    refetchInterval: (q) => (q.state.status === "error" ? false : 60_000),
    retry: false,
  });

  useEffect(() => {
    if (!data || !projectId) return;
    const prefix = `alert:${projectId}:`;
    const store = useNotifications.getState();
    const active = new Set(data.items.map((a) => prefix + a.id));
    for (const item of store.items) if (item.id.startsWith(prefix) && !active.has(item.id)) store.remove(item.id);
    for (const a of data.items) {
      const id = prefix + a.id;
      if (!store.markFired(`${userId}:${id}`)) continue;
      const t = TEXT[a.type];
      notify.warning(t.title, { id, description: t.description, action: { label: "Open", appId: t.appId }, persist: true, os: true });
    }
  }, [data, projectId, userId]);
}
