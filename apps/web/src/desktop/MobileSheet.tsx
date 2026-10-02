"use client";

import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { findApp } from "@/apps/registry";
import { AppIcon } from "./AppIcon";
import { AppView } from "./AppView";
import { selectFocusedId, useWindowStore } from "./window-store";

/** Mobile: chỉ hiện app đang focus dưới dạng sheet toàn màn hình, không kéo/resize. */
export function MobileSheet() {
  const focusedId = useWindowStore(selectFocusedId);
  const close = useWindowStore((s) => s.close);
  const app = focusedId ? findApp(focusedId) : undefined;

  return (
    <AnimatePresence>
      {app && (
        <motion.section
          key={app.id}
          role="dialog"
          aria-label={app.title}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close(app.id);
          }}
          className="fixed inset-x-0 bottom-0 top-10 z-40 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/60 bg-background pb-[env(safe-area-inset-bottom)]"
        >
          <header
            className="flex h-12 shrink-0 items-center gap-2 border-b border-white/30 px-2 backdrop-blur-2xl"
            style={{ background: "var(--bar-bg)", color: "var(--bar-ink)" }}
          >
            <button type="button" aria-label="Back" onClick={() => close(app.id)} className="flex h-9 items-center gap-0.5 rounded-lg pl-1 pr-3 text-sm font-semibold active:bg-white/30">
              <ChevronLeft className="size-5" />
              Back
            </button>
            <AppIcon name={app.icon} size={22} />
            <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{app.title}</h2>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            <AppView appId={app.id} />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
