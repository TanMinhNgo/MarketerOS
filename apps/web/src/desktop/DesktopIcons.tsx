"use client";

import { useRef } from "react";
import { apps, type AppManifest } from "@/apps/registry";
import { cn } from "@/lib/utils";
import { AppIcon } from "./AppIcon";

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

const left = apps.filter((a) => a.position === "left" && !a.hidden);
const right = apps.filter((a) => a.position === "right" && !a.hidden);
const order = [...left, ...right].map((a) => a.id);

export function DesktopIcons({ selectedId, onSelect, onOpen }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const move = (from: string, delta: number) => {
    const next = order[(order.indexOf(from) + delta + order.length) % order.length];
    onSelect(next);
    refs.current.get(next)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) {
      e.preventDefault();
      move(id, step);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpen(id);
    }
  };

  const column = (list: AppManifest[], side: "left-5" | "right-5") => (
    <ul className={cn(
        "absolute top-14 z-10 flex max-h-[calc(100vh-7rem)] flex-col content-start gap-x-2 gap-y-3",
        side === "left-5" ? "flex-wrap" : "flex-wrap-reverse",
        side,
      )}>
      {list.map((app, i) => {
        const selected = app.id === selectedId;
        return (
          <li key={app.id}>
            <button
              type="button"
              ref={(el) => {
                if (el) refs.current.set(app.id, el);
                else refs.current.delete(app.id);
              }}
              aria-label={`${app.title}. Double-click or press Enter to open`}
              aria-pressed={selected}
              tabIndex={(selectedId ?? order[0]) === app.id ? 0 : -1}
              onClick={() => onSelect(app.id)}
              onDoubleClick={() => onOpen(app.id)}
              onKeyDown={(e) => onKeyDown(e, app.id)}
              className={cn(
                "group flex w-24 flex-col items-center gap-2 rounded-2xl p-2 outline-none transition-colors",
                "hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white",
                selected && "bg-white/25 ring-1 ring-white/70",
              )}
            >
              <span
                className="icon-bob block drop-shadow-[0_8px_6px_rgba(20,10,60,0.35)] transition-transform group-hover:scale-110"
                style={{ animationDelay: `-${(i * 1.1).toFixed(1)}s` }}
              >
                <AppIcon name={app.icon} size={64} />
              </span>
              <span
                className="rounded-lg px-2 py-0.5 text-center text-xs font-semibold leading-tight backdrop-blur-md"
                style={{ background: "var(--label-bg)", color: "var(--label-ink)" }}
              >
                {app.title}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label="Desktop apps">
      {column(left, "left-5")}
      {column(right, "right-5")}
    </nav>
  );
}
