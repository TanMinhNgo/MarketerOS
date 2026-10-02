"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { Window } from "./Window";
import { useWindowStore } from "./window-store";

/** Vùng làm việc giữa MenuBar và Taskbar; đo kích thước để store kẹp cửa sổ trong đó. */
export function WindowLayer() {
  const ids = useWindowStore(useShallow((s) => s.windows.map((w) => w.id)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      useWindowStore.getState().setArea(Math.round(entry.contentRect.width), Math.round(entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 bottom-12 top-10 z-20">
      <AnimatePresence>
        {ids.map((id) => (
          <Window key={id} id={id} />
        ))}
      </AnimatePresence>
    </div>
  );
}
