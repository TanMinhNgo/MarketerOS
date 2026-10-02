"use client";

import { useAuth } from "@clerk/nextjs";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apps } from "@/apps/registry";
import { useDocsNav } from "@/apps/docs/docs-nav";
import { ProjectIcon } from "@/components/project-icon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useActiveProject } from "@/stores/active-project";
import { AppIcon } from "../AppIcon";
import { useIsMobile } from "../use-mobile";
import { useWindowStore } from "../window-store";
import { buildResults, flatten, type SearchItem } from "./search-index";
import { useSearch } from "./search-store";

type DocRef = { id: string; title: string; summary: string };

function Body({ onDone }: { onDone: () => void }) {
  const { isSignedIn } = useAuth();
  const isMobile = useIsMobile();
  const projects = useProjects(!!isSignedIn);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [docs, setDocs] = useState<DocRef[]>([]);

  // Nội dung Docs khá nặng nên chỉ nạp khi hộp tìm kiếm mở lần đầu.
  useEffect(() => {
    let alive = true;
    void import("@/apps/docs/sections").then((m) => alive && setDocs(m.SECTIONS.map(({ id, title, summary }) => ({ id, title, summary }))));
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(
    () =>
      buildResults(query, {
        apps,
        docs,
        projects: projects.data?.items ?? [],
        signedIn: !!isSignedIn,
      }),
    [query, docs, projects.data, isSignedIn],
  );
  const flat = useMemo(() => flatten(groups), [groups]);
  const current = flat[Math.min(active, flat.length - 1)];

  useEffect(() => {
    if (current) document.getElementById(`search-opt-${current.id}`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (item: SearchItem) => {
    onDone();
    const st = useWindowStore.getState();
    // Mobile chỉ hiện một app một lúc: đóng các app khác trước khi mở.
    if (isMobile) for (const w of st.windows) if (w.id !== item.appId) st.close(w.id);
    if (item.kind === "doc" && item.sectionId) useDocsNav.getState().go(item.sectionId);
    if (item.kind === "project" && item.projectId) useActiveProject.getState().setActive(item.projectId);
    st.open(item.appId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      choose(current);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="search-listbox"
          aria-activedescendant={current ? `search-opt-${current.id}` : undefined}
          aria-label="Search apps, docs and projects"
          placeholder="Search apps, docs and projects…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">esc</kbd>
      </div>

      <div id="search-listbox" role="listbox" aria-label="Results" className="max-h-[min(55vh,420px)] overflow-y-auto p-2">
        {flat.length === 0 && (
          <p role="status" className="px-3 py-8 text-center text-sm text-muted-foreground">
            No results for &ldquo;{query}&rdquo;. Try an app name like Projects, or a topic like windows.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.kind} role="group" aria-label={g.label} className="mb-1">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
            {g.items.map((item) => {
              const selected = item.id === current?.id;
              return (
                <div
                  key={item.id}
                  id={`search-opt-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(flat.indexOf(item))}
                  onClick={() => choose(item)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", selected ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                >
                  {item.kind === "project" ? (
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-[#3B2A4A] text-white" style={{ background: item.color ?? "#6D5BFF" }}>
                      <ProjectIcon name={item.projectIcon ?? null} className="size-4" />
                    </span>
                  ) : (
                    item.icon && <AppIcon name={item.icon} size={28} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    {item.subtitle && <span className={cn("block truncate text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{item.subtitle}</span>}
                  </span>
                  {selected && <kbd className="font-mono text-[10px] opacity-80">↵</kbd>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <footer className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-mono">↑↓</kbd> navigate</span>
        <span><kbd className="font-mono">↵</kbd> open</span>
        <span><kbd className="font-mono">esc</kbd> close</span>
      </footer>
    </>
  );
}

/** Hộp tìm kiếm kiểu Spotlight: bấm kính lúp hoặc Ctrl/Cmd+K. */
export function SearchPalette() {
  const open = useSearch((s) => s.open);
  const setOpen = useSearch((s) => s.setOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useSearch.setState((s) => ({ open: !s.open }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        // Không trả focus về nút kính lúp: cửa sổ vừa mở tự lấy focus.
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="top-[14%] translate-y-0 gap-0 overflow-hidden rounded-2xl border-2 border-[#3B2A4A] p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Find apps, documentation sections and your projects. Use the arrow keys and Enter.</DialogDescription>
        <Body onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
