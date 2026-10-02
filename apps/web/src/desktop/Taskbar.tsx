"use client";

import { AnimatePresence, motion } from "motion/react";
import { findApp } from "@/apps/registry";
import { cn } from "@/lib/utils";
import { AppIcon } from "./AppIcon";
import { selectFocusedId, useWindowStore } from "./window-store";

/** Thanh dưới: liệt kê cửa sổ đang mở; bấm để focus, hoặc khôi phục nếu đang thu nhỏ. */
export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focusedId = useWindowStore(selectFocusedId);
  const { open, focus } = useWindowStore.getState();

  return (
    <AnimatePresence>
      {windows.length > 0 && (
    <motion.nav
      aria-label="Open windows"
      initial={{ y: 48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 48, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-2 overflow-x-auto border-t border-white/25 px-3 backdrop-blur-xl"
      style={{ background: "var(--bar-bg)", color: "var(--bar-ink)" }}
    >
      {windows.map((w) => {
        const app = findApp(w.appId);
        if (!app) return null;
        const active = w.id === focusedId;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={active}
            onClick={() => (w.minimized ? open(w.appId) : focus(w.id))}
            className={cn(
              "flex h-9 max-w-44 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors",
              "hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-current",
              active ? "bg-white/40 ring-1 ring-white/70" : w.minimized && "opacity-60",
            )}
          >
            <AppIcon name={app.icon} size={20} />
            <span className="truncate">{app.title}</span>
          </button>
        );
      })}
    </motion.nav>
      )}
    </AnimatePresence>
  );
}
