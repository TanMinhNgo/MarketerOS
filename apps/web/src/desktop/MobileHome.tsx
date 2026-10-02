"use client";

import { apps } from "@/apps/registry";
import { AppIcon } from "./AppIcon";

/** Mobile: icon xếp thành lưới, chạm một lần để mở. */
export function MobileHome({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <nav aria-label="Apps" className="absolute inset-x-0 bottom-0 top-44 z-10 overflow-y-auto px-4 pb-8">
      <ul className="mx-auto grid max-w-sm grid-cols-[repeat(3,minmax(0,1fr))] gap-x-2 gap-y-4">
        {apps.filter((a) => !a.hidden).map((app) => (
          <li key={app.id}>
            <button type="button" onClick={() => onOpen(app.id)} aria-label={app.title} className="flex w-full flex-col items-center gap-2 rounded-2xl p-2 active:bg-white/25">
              <span className="block drop-shadow-[0_8px_6px_rgba(20,10,60,0.35)]">
                <AppIcon name={app.icon} size={60} />
              </span>
              <span className="rounded-lg px-2 py-0.5 break-words text-center text-xs font-semibold leading-tight backdrop-blur-md" style={{ background: "var(--label-bg)", color: "var(--label-ink)" }}>
                {app.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
