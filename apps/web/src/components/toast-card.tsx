"use client";

import { BellRing, CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useWindowStore } from "@/desktop/window-store";
import type { NotifyKind } from "@/lib/notify/notification-store";

export interface NotifyAction {
  label: string;
  /** Mở app này (cửa sổ) khi bấm. */
  appId?: string;
  onClick?: () => void;
}

export const KIND_STYLE: Record<NotifyKind, { icon: LucideIcon; color: string; ink: string }> = {
  success: { icon: CircleCheck, color: "#3DD68C", ink: "#FFFFFF" },
  info: { icon: Info, color: "#6D5BFF", ink: "#FFFFFF" },
  warning: { icon: TriangleAlert, color: "#FFC531", ink: "#3B2A4A" },
  error: { icon: CircleX, color: "#FF5D7A", ink: "#FFFFFF" },
  reminder: { icon: BellRing, color: "#38BDF8", ink: "#FFFFFF" },
};

/** Toast theo phong cách MarketOS: viền đậm, bóng lệch, bong bóng icon màu và thanh đếm ngược. */
export function ToastCard({ id, kind, title, description, action, duration }: { id: string | number; kind: NotifyKind; title: string; description?: string; action?: NotifyAction; duration: number }) {
  const style = KIND_STYLE[kind];
  const Icon = style.icon;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="relative flex w-[360px] max-w-[calc(100vw-2rem)] gap-3 overflow-hidden rounded-2xl border-2 border-[#3B2A4A] bg-background p-3 pr-9 text-foreground shadow-[0_5px_0_#3B2A4A]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-[#3B2A4A] shadow-[inset_0_-3px_4px_rgba(0,0,0,0.12)]" style={{ background: style.color, color: style.ink }}>
        <Icon className="size-4" strokeWidth={2.6} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-bold leading-snug">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        {action && (
          <button
            type="button"
            onClick={() => {
              if (action.appId) useWindowStore.getState().open(action.appId);
              action.onClick?.();
              toast.dismiss(id);
            }}
            className="mt-2 rounded-full border-2 border-[#3B2A4A] px-3 py-0.5 text-xs font-bold shadow-[0_2px_0_#3B2A4A] transition-transform hover:-translate-y-px active:translate-y-0.5 active:shadow-none"
            style={{ background: style.color, color: style.ink }}
          >
            {action.label}
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => toast.dismiss(id)} className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <X className="size-3.5" />
      </button>
      <span aria-hidden="true" className="toast-progress absolute inset-x-0 bottom-0 h-1 origin-left" style={{ background: style.color, animationDuration: `${duration}ms` }} />
    </div>
  );
}
