"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api-client";
import { notify } from "@/lib/notify/notify";

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
        mutationCache: new MutationCache({ onError: (e) => notify.error(errorMessage(e)) }),
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
