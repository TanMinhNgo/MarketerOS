"use client";

import { PlanLimitDetailsSchema } from "@marketos/shared";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify/notify";

/** Chạm giới hạn gói (403 PLAN_LIMIT, hiện chỉ có số dự án): báo rõ và mở được trang gói. */
function onMutationError(e: unknown) {
  const details = e instanceof ApiError && e.code === "PLAN_LIMIT" ? PlanLimitDetailsSchema.safeParse(e.details) : null;
  if (!details?.success) return notify.error(errorMessage(e));
  const { plan, limit } = details.data;
  notify.warning("Project limit reached", {
    description: plan === "free" ? `The Free plan includes ${limit} active projects. Upgrade to Pro for more, or move a project to Trash.` : `Your plan includes ${limit} active projects. Move a project to Trash to make room.`,
    action: { label: "See plans", appId: "plans-billing" },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Lỗi 4xx là lỗi của yêu cầu, thử lại cũng vô ích.
            retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
          },
        },
        // `meta.silent`: mutation tự hiện lỗi tại chỗ (vd. thẻ hành động của AI Assistant).
        mutationCache: new MutationCache({
          onError: (e, _v, _c, m) => {
            if (!m.meta?.silent) onMutationError(e);
          },
        }),
        // Lỗi tải dữ liệu hiển thị tại chỗ trong từng app; chỉ báo toast khi đã có dữ liệu cũ mà làm mới thất bại.
        queryCache: new QueryCache({
          onError: (e, query) => {
            if (query.state.data !== undefined) notify.error(errorMessage(e));
          },
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-right" offset={{ bottom: 64, right: 16 }} mobileOffset={{ bottom: 16, right: 16, left: 16 }} visibleToasts={4} gap={12} />
    </QueryClientProvider>
  );
}
