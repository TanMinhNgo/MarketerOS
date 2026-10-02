"use client";

import { Search } from "lucide-react";
import { useSearch } from "./search-store";

/** Nút kính lúp trên MenuBar: mở hộp tìm kiếm (cũng mở được bằng Ctrl/Cmd+K). */
export function SearchButton() {
  const setOpen = useSearch((s) => s.setOpen);
  return (
    <button
      type="button"
      aria-label="Search (Ctrl+K)"
      title="Search (Ctrl+K)"
      onClick={() => setOpen(true)}
      className="grid size-8 place-items-center rounded-md transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-current"
    >
      <Search className="size-4" />
    </button>
  );
}
