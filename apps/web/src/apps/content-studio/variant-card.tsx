"use client";

import type { GeneratedVariant } from "@marketos/shared";
import { Check, Copy, ImagePlus, RefreshCw, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { notify } from "@/lib/notify/notify";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { variantToText } from "./channels";
import { AssetStrip } from "../media-library/asset-thumb";
import { GenerateDialog } from "../media-library";
import { ImagePicker } from "../media-library/post-media";
import { MAX_PER_POST } from "@/lib/media-api";
import type { VariantState } from "./use-generation";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify.success("Copied to clipboard", { duration: 2500 });
  } catch {
    notify.error("Couldn't copy", { description: "Select the text and copy it manually." });
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

type CardProps = { projectId: string; index: number; saving: boolean; onSave: (v: GeneratedVariant, assetIds: string[]) => Promise<void>; onRegenerate?: () => void };

/** Biến thể đã xong: sửa trực tiếp, sao chép, tạo lại, lưu thành bản nháp. */
function Editable({ projectId, index, initial, saving, onSave, onRegenerate }: CardProps & { initial: GeneratedVariant }) {
  const [v, setV] = useState<GeneratedVariant>(initial);
  // Ảnh gắn kèm khi lưu nháp (chọn từ thư viện hoặc tạo bằng AI từ chính nội dung bài).
  const [images, setImages] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"pick" | "create" | null>(null);
  const setImg = (ids: string[]) => {
    setImages(ids.slice(0, MAX_PER_POST));
    setSaved(false);
  };
  const [saved, setSaved] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const edited = v !== initial;
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
        {onRegenerate && (
          <Button
            type="button"
            variant={confirmRegen ? "destructive" : "ghost"}
            size="sm"
            title="Write a new version of this variant (every 3 regenerates use 1 generation)"
            onBlur={() => setConfirmRegen(false)}
            onClick={() => (edited && !confirmRegen ? setConfirmRegen(true) : onRegenerate())}
          >
            <RefreshCw /> {confirmRegen ? "Discard edits?" : "Regenerate"}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => copyText(variantToText(v))}>
          <Copy /> Copy
        </Button>
      </div>
      <Input aria-label={`Variant ${index + 1} title`} value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className="font-semibold" />
      <Textarea aria-label={`Variant ${index + 1} text`} value={v.body} rows={6} maxLength={10000} onChange={(e) => set("body", e.target.value)} />
      <TagInput value={v.hashtags} onChange={(h) => set("hashtags", h)} placeholder="Add hashtag…" max={20} />
      <Input aria-label={`Variant ${index + 1} call to action`} value={v.cta} placeholder="Call to action (optional)" maxLength={300} onChange={(e) => set("cta", e.target.value)} />
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Images</p>
          <Button type="button" size="xs" variant="outline" disabled={images.length >= MAX_PER_POST} onClick={() => setDialog("pick")}>
            <ImagePlus /> From library
          </Button>
          <Button type="button" size="xs" variant="outline" disabled={images.length >= MAX_PER_POST} onClick={() => setDialog("create")}>
            <Sparkles /> Create with AI
          </Button>
        </div>
        {images.length > 0 && <AssetStrip projectId={projectId} ids={images} onRemove={(id) => setImg(images.filter((x) => x !== id))} />}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={invalid || saving || saved}
        onClick={async () => {
          await onSave({ ...v, title: v.title.trim(), body: v.body.trim(), cta: v.cta.trim() }, images);
          setSaved(true);
        }}
      >
        {saved ? <Check /> : <Save />} {saved ? "Saved to drafts" : saving ? "Saving…" : "Save as draft"}
      </Button>
      {dialog === "pick" && <ImagePicker projectId={projectId} initial={images} saving={false} onClose={() => setDialog(null)} onSave={(ids) => {
            setImg(ids);
            setDialog(null);
          }} />}
      {dialog === "create" && (
        <GenerateDialog
          projectId={projectId}
          defaultPrompt={`An image for this post: ${v.title}. ${v.body.slice(0, 400)}`}
          onCreated={(a) => setImg([...images, a.id])}
          onClose={() => setDialog(null)}
        />
      )}
    </article>
  );
}

export function VariantCard({ state, ...props }: CardProps & { state: VariantState }) {
  if (!state.done) return <Streaming index={props.index} data={state.data} />;
  return <Editable {...props} initial={state.data as GeneratedVariant} />;
}
