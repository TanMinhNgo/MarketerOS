"use client";

import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ảnh minh hoạ. Chưa có file ảnh thì hiện khung giữ chỗ thay vì ảnh vỡ. */
export function Figure({ src, alt, caption, narrow }: { src: string; alt: string; caption: string; narrow?: boolean }) {
  const [missing, setMissing] = useState(false);
  return (
    <figure className={cn("my-4", narrow && "mx-auto max-w-[260px]")}>
      {missing ? (
        <div className="grid aspect-video place-items-center rounded-xl border-2 border-dashed bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          Screenshot coming soon: {alt}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong /public/docs, kích thước phụ thuộc cửa sổ
        <img src={src} alt={alt} loading="lazy" onError={() => setMissing(true)} className="w-full rounded-xl border-2 border-[#3B2A4A]/70 shadow-[0_4px_0_rgba(59,42,74,0.25)]" />
      )}
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

/** Danh sách bước đánh số; mỗi bước có tiêu đề ngắn và phần mô tả. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="my-4 space-y-3 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:top-0 before:grid before:size-7 before:place-items-center before:rounded-full before:border-2 before:border-[#3B2A4A] before:bg-primary before:text-xs before:font-bold before:text-primary-foreground before:content-[counter(step)]">
      <p className="font-semibold leading-7">{title}</p>
      {children && <div className="text-sm text-muted-foreground [&_p]:mt-1">{children}</div>}
    </li>
  );
}

const tone = {
  tip: { icon: Lightbulb, cls: "border-emerald-500/40 bg-emerald-500/10", label: "Tip" },
  note: { icon: Info, cls: "border-sky-500/40 bg-sky-500/10", label: "Note" },
  warn: { icon: TriangleAlert, cls: "border-amber-500/50 bg-amber-500/10", label: "Heads up" },
} as const;

export function Callout({ kind = "note", children }: { kind?: keyof typeof tone; children: ReactNode }) {
  const t = tone[kind];
  return (
    <aside className={cn("my-4 flex gap-3 rounded-xl border p-3 text-sm", t.cls)}>
      <t.icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <span className="font-semibold">{t.label}: </span>
        {children}
      </div>
    </aside>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border-b-2 border-[#3B2A4A]/40 bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">{children}</kbd>;
}

export function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 mt-6 font-display text-base font-bold first:mt-0">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="my-2 text-sm leading-relaxed">{children}</p>;
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
