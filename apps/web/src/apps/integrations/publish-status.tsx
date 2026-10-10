"use client";

import type { ContentResponse } from "@marketos/shared";
import { ExternalLink, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useContentAssets } from "@/lib/media-api";
import { ERROR_TEXT, isPublishable, latestFor, useCanPublish, useChannelConnection, usePublications, usePublishNow, type Publication } from "@/lib/integrations-api";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { channelLabel } from "../content-studio/channels";
import { AssetThumb } from "../media-library/asset-thumb";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Dòng trạng thái của một bài: đã đăng / đang đăng / lỗi / sẽ tự đăng / chưa kết nối. `target` null = chưa kết nối. */
function statusNote(last: Publication | undefined, target: string | null, item: ContentResponse): React.ReactNode {
  if (last?.status === "PUBLISHED")
    return (
      <span className="text-emerald-700 dark:text-emerald-300">
        Published {last.publishedAt && when.format(new Date(last.publishedAt))}
        {last.externalUrl && (
          <a href={last.externalUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
            View post <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </span>
    );
  if (last?.status === "QUEUED" || last?.status === "PUBLISHING") return <span className="text-sky-700 dark:text-sky-300">Publishing to {target ?? channelLabel(item.channel)}…</span>;
  if (last?.status === "FAILED") return <span className="text-destructive">Couldn&apos;t publish. {last.errorCode ? ERROR_TEXT[last.errorCode] : ""}</span>;
  if (target && item.status === "SCHEDULED" && item.scheduledAt) return <span className="text-muted-foreground">Auto-publishes to {target} on {when.format(new Date(item.scheduledAt))}</span>;
  if (!target && (item.status === "READY" || item.status === "SCHEDULED")) return <span className="text-muted-foreground">Connect {channelLabel(item.channel)} in Integrations to publish it.</span>;
  return null;
}

/** Bản xem trước đúng nội dung sẽ đăng: chữ đầy đủ và ảnh theo thứ tự gắn vào bài. */
function PublishPreview({ projectId, item }: Readonly<{ projectId: string; item: ContentResponse }>) {
  const media = useContentAssets(projectId, item.id);
  const caption = [item.body, item.hashtags.join(" "), item.cta].filter(Boolean).join("\n\n");
  return (
    <div className="w-full space-y-2 rounded-lg border bg-muted/40 p-2.5">
      <p className="font-semibold">This is what will be posted</p>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap">{caption}</p>
      {media.isPending && <p className="text-muted-foreground">Loading images…</p>}
      {!!media.data?.items.length && (
        <ol className="flex flex-wrap gap-2" aria-label="Images, in posting order">
          {media.data.items.map((a, i) => (
            <li key={a.id} className="relative">
              <AssetThumb projectId={projectId} asset={a} className="size-14" />
              <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px] font-bold">{i + 1}</span>
            </li>
          ))}
        </ol>
      )}
      {media.data && !media.data.items.length && <p className="text-muted-foreground">No images, text only.</p>}
    </div>
  );
}

/**
 * Trạng thái đăng lên kênh thật của một bài + nút Publish now (có bước xác nhận vì đăng ra ngoài).
 * Không hiện gì khi gói không có Integrations; chỉ hiển thị kênh có adapter xuất bản.
 */
export function PublishStatus({ projectId, item, className }: Readonly<{ projectId: string; item: ContentResponse; className?: string }>) {
  const canPublish = useCanPublish();
  const connection = useChannelConnection(projectId, item.channel);
  const pubs = usePublications(projectId);
  const publish = usePublishNow(projectId);
  const [confirming, setConfirming] = useState(false);
  if (!canPublish) return null;
  if (!isPublishable(item.channel)) return null;

  const last = latestFor(pubs.data, item.id);
  const target = connection?.displayName ?? channelLabel(item.channel);
  const approved = item.status === "READY" || item.status === "SCHEDULED";
  const pending = last?.status === "QUEUED" || last?.status === "PUBLISHING";

  const run = () =>
    publish.mutate(item, {
      onSuccess: () => {
        setConfirming(false);
        notify.info("Publishing…", { description: `Posting to ${target}. You'll see the link here when it's live.` });
      },
      onError: (e) => notify.apiError("Couldn't publish", e),
    });

  const note = statusNote(last, connection ? target : null, item);

  const showButton = connection && approved && !pending && last?.status !== "PUBLISHED";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      {note}
      {showButton &&
        (confirming ? (
          <>
            <PublishPreview projectId={projectId} item={item} />
            <Button size="xs" disabled={publish.isPending} onClick={run}>{publish.isPending ? "Publishing…" : `Post to ${target} now`}</Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="xs" variant="outline" onClick={() => setConfirming(true)}>
            <Send /> Publish now
          </Button>
        ))}
    </div>
  );
}
