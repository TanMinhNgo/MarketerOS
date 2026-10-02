"use client";

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { apps } from "@/apps/registry";

/** Mỗi app tạo một component lazy duy nhất ở mức module để mở lại không bị khởi tạo lại. */
const LAZY_APPS: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(apps.map((a) => [a.id, lazy(a.component)]));

function Skeleton() {
  return (
    <div className="space-y-3 p-6" role="status" aria-label="Loading app">
      <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/** Nội dung app (lazy + skeleton), dùng chung cho cửa sổ desktop và sheet mobile. */
export function AppView({ appId }: { appId: string }) {
  const App = LAZY_APPS[appId];
  return (
    <Suspense fallback={<Skeleton />}>
      <App />
    </Suspense>
  );
}
