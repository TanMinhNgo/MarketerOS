"use client";

import type { ContentResponse } from "@marketos/shared";
import { Check, ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { MAX_PER_POST, useAssets, useContentAssets, useSetContentAssets } from "@/lib/media-api";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { AssetThumb } from "./asset-thumb";

/** Chọn ảnh từ thư viện; thứ tự chọn = thứ tự ảnh trong bài. */
export function ImagePicker({ projectId, initial, onSave, onClose, saving }: Readonly<{ projectId: string; initial: string[]; onSave: (ids: string[]) => void; onClose: () => void; saving: boolean }>) {
  const open = useWindowStore((s) => s.open);
  const assets = useAssets(projectId);
  const [picked, setPicked] = useState(initial);
  const items = assets.data?.pages.flatMap((p) => p.items) ?? [];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_PER_POST ? [...p, id] : p));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose images</DialogTitle>
          <DialogDescription>Up to {MAX_PER_POST}, in the order you pick them. {picked.length} selected.</DialogDescription>
        </DialogHeader>
        {assets.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {assets.error && <p className="text-sm text-destructive">{errorMessage(assets.error)}</p>}
        {assets.data && !items.length && (
          <p className="text-sm text-muted-foreground">
            No images in this project yet.{" "}
            <Button size="xs" variant="link" className="h-auto p-0" onClick={() => open("media-library")}>Open Media Library</Button>
          </p>
        )}
        <ul className="grid max-h-[55vh] grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 overflow-y-auto p-1">
          {items.map((a) => {
            const n = picked.indexOf(a.id);
            return (
              <li key={a.id}>
                <button type="button" aria-pressed={n >= 0} aria-label={a.name} onClick={() => toggle(a.id)} className={cn("relative block w-full rounded-xl", n >= 0 && "ring-3 ring-primary")}>
                  <AssetThumb projectId={projectId} asset={a} className="aspect-square" />
                  {n >= 0 && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n + 1}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {assets.hasNextPage && <Button size="sm" variant="outline" onClick={() => assets.fetchNextPage()}>Load more</Button>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={() => onSave(picked)}><Check /> {saving ? "Saving…" : "Use these images"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ảnh của một bài: xem, gỡ, chọn thêm. Đổi ảnh bài đã duyệt thì bài về Needs review (luật backend). */
export function PostMedia({ projectId, item }: Readonly<{ projectId: string; item: ContentResponse }>) {
  const media = useContentAssets(projectId, item.id);
  const save = useSetContentAssets(projectId, item.id);
  const [picking, setPicking] = useState(false);
  const ids = media.data?.items.map((a) => a.id) ?? [];
  const approved = item.status === "READY" || item.status === "SCHEDULED";
  const locked = item.status === "DONE";

  const apply = (next: string[], done?: () => void) =>
    save.mutate(next, {
      onSuccess: () => {
        notify.success("Images updated", { description: approved ? "The post went back to Needs review. Approve it again to publish." : undefined });
        done?.();
      },
      onError: (e) => notify.apiError("Couldn't update the images", e),
    });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Images</p>
        {!locked && (
          <Button type="button" size="xs" variant="outline" disabled={media.isPending} onClick={() => setPicking(true)}>
            <ImagePlus /> {ids.length ? "Change" : "Add images"}
          </Button>
        )}
      </div>
      {media.error && <p className="text-xs text-destructive">{errorMessage(media.error)}</p>}
      {!!media.data?.items.length && (
        <ul className="flex flex-wrap gap-2">
          {media.data.items.map((a) => (
            <li key={a.id} className="relative">
              <AssetThumb projectId={projectId} asset={a} className="size-16" />
              {!locked && (
                <button type="button" aria-label={`Remove ${a.name}`} disabled={save.isPending} onClick={() => apply(ids.filter((x) => x !== a.id))} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background shadow">
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {approved && !locked && <p className="text-xs text-muted-foreground">Changing images sends an approved post back to Needs review.</p>}
      {picking && <ImagePicker projectId={projectId} initial={ids} saving={save.isPending} onClose={() => setPicking(false)} onSave={(next) => apply(next, () => setPicking(false))} />}
    </div>
  );
}
