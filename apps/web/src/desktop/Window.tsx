"use client";

import { Copy, Minus, Square, X } from "lucide-react";
import { motion } from "motion/react";
import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { findApp } from "@/apps/registry";
import { cn } from "@/lib/utils";
import { AppIcon } from "./AppIcon";
import { AppView } from "./AppView";
import { MIN_H, MIN_W, selectFocusedId, useWindowStore } from "./window-store";

/** Nút tác vụ dạng bong bóng kẹo: kính mờ khi nghỉ, hover thì đầy màu + bóng sáng, nảy lò xo. */
function Bubble({ label, color, onClick, children }: { label: string; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileHover={{ scale: 1.22 }}
      whileTap={{ scale: 0.82, scaleY: 0.7 }}
      transition={{ type: "spring", stiffness: 520, damping: 14 }}
      className="win-ctrl win-bubble"
      style={{ "--c": color } as CSSProperties}
    >
      {children}
    </motion.button>
  );
}

/** Mỗi cửa sổ chỉ subscribe vào state của chính nó nên kéo/focus cửa sổ khác không làm nó render lại. */
export const Window = memo(function Window({ id }: { id: string }) {
  const stored = useWindowStore((s) => s.windows.find((w) => w.id === id));
  // Khi đóng, store xoá cửa sổ trước khi animation thoát chạy xong: giữ bản cuối để vẽ tiếp.
  const [last, setLast] = useState(stored);
  if (stored && stored !== last) setLast(stored);
  const win = stored ?? last;

  const focused = useWindowStore((s) => selectFocusedId(s) === id);
  const { focus, close, minimize, toggleMaximize, move, resize } = useWindowStore.getState();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (focused && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [focused]);

  const app = win && findApp(win.appId);
  if (!win || !app) return null;
  const { minimized, maximized } = win;

  return (
    <Rnd
      position={maximized ? { x: 0, y: 0 } : { x: win.x, y: win.y }}
      // Phóng to = lấp đầy khung chứa bằng CSS (100%), không phụ thuộc kích thước đã đo trong store.
      size={maximized ? { width: "100%", height: "100%" } : { width: win.w, height: win.h }}
      minWidth={MIN_W}
      minHeight={MIN_H}
      bounds="parent"
      dragHandleClassName="win-titlebar"
      cancel=".win-ctrl"
      disableDragging={maximized || minimized}
      enableResizing={!maximized && !minimized}
      onDragStart={() => document.documentElement.classList.add("win-dragging")}
      onDragStop={(_e, d) => {
        document.documentElement.classList.remove("win-dragging");
        move(id, d.x, d.y);
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => resize(id, ref.offsetWidth, ref.offsetHeight, pos.x, pos.y)}
      // react-rnd mặc định gắn cursor: auto lên khung, làm nội dung bên trong mất con trỏ riêng.
      style={{ zIndex: win.z, pointerEvents: minimized ? "none" : "auto", cursor: "inherit" }}
    >
      <motion.div
        ref={root}
        role="dialog"
        aria-label={app.title}
        tabIndex={-1}
        inert={minimized}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={minimized ? { opacity: 0, scale: 0.7, y: 160 } : { opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onPointerDownCapture={() => focus(id)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close(id);
        }}
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl border text-foreground outline-none",
          focused ? "border-white/80 shadow-[0_24px_60px_rgba(10,20,70,0.45)]" : "border-white/40 shadow-[0_10px_30px_rgba(10,20,70,0.3)]",
        )}
      >
        <div
          className={cn("win-titlebar flex h-10 shrink-0 select-none items-center border-b border-white/30 gap-2.5 pl-3 pr-3 backdrop-blur-2xl", !focused && "opacity-80")}
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.14) 100%), var(--bar-bg)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -1px 0 rgba(255,255,255,0.12)",
            color: "var(--bar-ink)",
          }}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) toggleMaximize(id);
          }}
        >
          <AppIcon name={app.icon} size={20} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{app.title}</span>
          <Bubble label="Minimize" color="#FFC531" onClick={() => minimize(id)}>
            <Minus strokeWidth={3.5} className="size-3" />
          </Bubble>
          <Bubble label={maximized ? "Restore" : "Maximize"} color="#3DD68C" onClick={() => toggleMaximize(id)}>
            {maximized ? <Copy strokeWidth={3} className="size-3" /> : <Square strokeWidth={3.5} className="size-2.5" />}
          </Bubble>
          <Bubble label="Close" color="#FF5D7A" onClick={() => close(id)}>
            <X strokeWidth={3.5} className="size-3" />
          </Bubble>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-background/90 backdrop-blur-md">
          <AppView appId={win.appId} />
        </div>
      </motion.div>
    </Rnd>
  );
});
