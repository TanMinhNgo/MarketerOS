"use client";

import { ImageOff, Sparkles, X } from "lucide-react";
import { useAssets, useAssetUrl, type Asset } from "@/lib/media-api";
import { cn } from "@/lib/utils";

/** Ảnh xem trước của một asset (URL ký tạm, tự làm mới). `fit="contain"` khi xem lớn. */
export function AssetThumb({ projectId, asset, className, fit = "cover" }: Readonly<{ projectId: string; asset: Asset; className?: string; fit?: "cover" | "contain" }>) {
  const url = useAssetUrl(projectId, asset.id);
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted", className)}>
      {url.data ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL ký tạm từ storage riêng, không qua tối ưu ảnh của Next
        <img src={url.data.url} alt={asset.altText ?? asset.name} className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")} loading="lazy" />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground">
          {url.error ? <ImageOff className="size-5" aria-label="Image unavailable" /> : <span className="text-xs">Loading…</span>}
        </div>
      )}
      {asset.generationId && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <Sparkles className="size-3" aria-hidden="true" /> AI
        </span>
      )}
    </div>
  );
}

/** Ảnh thu nhỏ theo ID (tìm trong thư viện đã tải; ID chưa có trong trang đã tải thì đếm chung). `onRemove` để gỡ từng ảnh. */
export function AssetStrip({ projectId, ids, onRemove }: Readonly<{ projectId: string; ids: string[]; onRemove?: (id: string) => void }>) {
  const items = useAssets(projectId).data?.pages.flatMap((p) => p.items) ?? [];
  const found = ids.map((id) => items.find((a) => a.id === id)).filter((a) => a !== undefined);
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {found.map((a) => (
        <li key={a.id} className="relative">
          <AssetThumb projectId={projectId} asset={a} className="size-14" />
          {onRemove && (
            <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onRemove(a.id)} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background shadow">
              <X className="size-3" />
            </button>
          )}
        </li>
      ))}
      {found.length < ids.length && <li className="text-xs text-muted-foreground">+{ids.length - found.length} more</li>}
    </ul>
  );
}
