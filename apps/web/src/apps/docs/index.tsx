"use client";

import { cn } from "@/lib/utils";
import { useDocsNav } from "./docs-nav";
import { SECTIONS } from "./sections";

/** Docs: thanh mục lục bên trái (hàng ngang khi cửa sổ hẹp) và nội dung bên phải. */
export default function App() {
  const activeId = useDocsNav((s) => s.sectionId) ?? SECTIONS[0].id;
  const setActiveId = useDocsNav((s) => s.go);
  const index = SECTIONS.findIndex((s) => s.id === activeId);
  const section = SECTIONS[index];
  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  return (
    <div className="@container flex h-full min-h-0">
      <div className="flex h-full min-h-0 w-full flex-col @2xl:flex-row">
        <nav aria-label="Docs sections" className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 @2xl:w-56 @2xl:flex-col @2xl:overflow-y-auto @2xl:border-b-0 @2xl:border-r">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === activeId ? "page" : undefined}
              onClick={() => setActiveId(s.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                s.id === activeId && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              <span className="mr-2 text-xs opacity-60">{i + 1}</span>
              {s.title}
            </button>
          ))}
        </nav>

        <article key={section.id} className="min-h-0 flex-1 overflow-y-auto p-5 @2xl:p-7">
          <header className="mb-4 border-b pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {index + 1} of {SECTIONS.length}
            </p>
            <h2 className="font-display text-2xl font-bold">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.summary}</p>
          </header>
          {section.body}
          <footer className="mt-8 flex items-center justify-between gap-3 border-t pt-4 text-sm">
            {prev ? (
              <button type="button" onClick={() => setActiveId(prev.id)} className="rounded-lg border px-3 py-2 text-left hover:bg-accent">
                <span className="block text-xs text-muted-foreground">Previous</span>
                {prev.title}
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button type="button" onClick={() => setActiveId(next.id)} className="rounded-lg border px-3 py-2 text-right hover:bg-accent">
                <span className="block text-xs text-muted-foreground">Next</span>
                {next.title}
              </button>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
