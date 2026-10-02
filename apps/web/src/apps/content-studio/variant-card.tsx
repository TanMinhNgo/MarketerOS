"use client";

import type { GeneratedVariant } from "@marketos/shared";
import { Check, Copy, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { variantToText } from "./channels";
import type { VariantState } from "./use-generation";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
  }
}

/** Biến thể đang stream: chỉ đọc, hiện dần từng phần khi chúng đến. */
function Streaming({ index, data }: { index: number; data: Partial<GeneratedVariant> }) {
  const empty = !data.title && !data.body;
  return (
    <article aria-busy="true" aria-label={`Variant ${index + 1}, generating`} className="rounded-2xl border-2 border-dashed border-[#3B2A4A]/40 bg-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant {index + 1}</p>
      {empty ? (
        <div className="space-y-2" role="status" aria-label="Waiting for the AI">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          {data.title && <h4 className="font-display text-base font-bold">{data.title}</h4>}
          {data.body && <p className="mt-1 whitespace-pre-wrap text-sm">{data.body}<span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" aria-hidden="true" /></p>}
          {!!data.hashtags?.length && <p className="mt-2 text-xs text-primary">{data.hashtags.join(" ")}</p>}
        </>
      )}
    </article>
  );
}

/** Biến thể đã xong: sửa trực tiếp, sao chép, lưu thành bản nháp. */
function Editable({ index, initial, saving, onSave }: { index: number; initial: GeneratedVariant; saving: boolean; onSave: (v: GeneratedVariant) => Promise<void> }) {
  const [v, setV] = useState<GeneratedVariant>(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof GeneratedVariant>(k: K, val: GeneratedVariant[K]) => {
    setV((cur) => ({ ...cur, [k]: val }));
    setSaved(false);
  };
  const invalid = !v.title.trim() || !v.body.trim();

  return (
    <article aria-label={`Variant ${index + 1}`} className="space-y-3 rounded-2xl border-2 border-[#3B2A4A]/50 bg-card p-4 shadow-[0_3px_0_rgba(59,42,74,0.2)]">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant {index + 1}</p>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => copyText(variantToText(v))}>
          <Copy /> Copy
        </Button>
      </div>
      <Input aria-label={`Variant ${index + 1} title`} value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className="font-semibold" />
      <Textarea aria-label={`Variant ${index + 1} text`} value={v.body} rows={6} maxLength={10000} onChange={(e) => set("body", e.target.value)} />
      <TagInput value={v.hashtags} onChange={(h) => set("hashtags", h)} placeholder="Add hashtag…" max={20} />
      <Input aria-label={`Variant ${index + 1} call to action`} value={v.cta} placeholder="Call to action (optional)" maxLength={300} onChange={(e) => set("cta", e.target.value)} />
      <Button
        type="button"
        size="sm"
        disabled={invalid || saving || saved}
        onClick={async () => {
          await onSave({ ...v, title: v.title.trim(), body: v.body.trim(), cta: v.cta.trim() });
          setSaved(true);
        }}
      >
        {saved ? <Check /> : <Save />} {saved ? "Saved to drafts" : saving ? "Saving…" : "Save as draft"}
      </Button>
    </article>
  );
}

export function VariantCard({ index, state, saving, onSave }: { index: number; state: VariantState; saving: boolean; onSave: (v: GeneratedVariant) => Promise<void> }) {
  if (!state.done) return <Streaming index={index} data={state.data} />;
  return <Editable index={index} initial={state.data as GeneratedVariant} saving={saving} onSave={onSave} />;
}
