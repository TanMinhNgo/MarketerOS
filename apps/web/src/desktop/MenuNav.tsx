"use client";

import { useWindowStore } from "./window-store";

const MENU = [
  { label: "Projects", appId: "projects" },
  { label: "Pricing", appId: "pricing" },
  { label: "Docs", appId: "docs" },
  { label: "About", appId: "about" },
];

/** Menu chính trên header: mỗi mục mở app (cửa sổ) tương ứng. */
export function MenuNav() {
  const open = useWindowStore((s) => s.open);
  return (
    <nav aria-label="Main menu" className="hidden items-center gap-1 sm:flex">
      {MENU.map((item) => (
        <button
          key={item.appId}
          type="button"
          onClick={() => open(item.appId)}
          className="rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
