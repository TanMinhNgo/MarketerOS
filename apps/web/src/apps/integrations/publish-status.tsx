"use client";

import type { ContentResponse } from "@marketos/shared";
import { ExternalLink, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ERROR_TEXT, isPublishable, latestFor, useCanPublish, useChannelConnection, usePublications, usePublishNow } from "@/lib/integrations-api";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { channelLabel } from "../content-studio/channels";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Trạng thái đăng lên kênh thật của một bài + nút Publish now (có bước xác nhận vì đăng ra ngoài).
 * Không hiện gì khi gói không có Integrations; kênh chưa hỗ trợ thì báo "in development".
 */
export function PublishStatus({ projectId, item, className }: Readonly<{ projectId: string; item: ContentResponse; className?: string }>) {
  const canPublish = useCanPublish();
  const connection = useChannelConnection(projectId, item.channel);
  const pubs = usePublications(projectId);
  const publish = usePublishNow(projectId);
  const [confirming, setConfirming] = useState(false);
  if (!canPublish) return null;
  if (!isPublishable(item.channel))
    return item.status === "READY" || item.status === "SCHEDULED" ? (
      <p className={cn("text-xs text-muted-foreground", className)}>Publishing to {channelLabel(item.channel)} is in development. Copy the post and share it yourself for now.</p>
    ) : null;

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

  let note: React.ReactNode = null;
  if (last?.status === "PUBLISHED")
    note = (
      <span className="text-emerald-700 dark:text-emerald-300">
        Published {last.publishedAt && when.format(new Date(last.publishedAt))}
        {last.externalUrl && (
          <a href={last.externalUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
            View post <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </span>
    );
  else if (pending) note = <span className="text-sky-700 dark:text-sky-300">Publishing to {target}…</span>;
  else if (last?.status === "FAILED") note = <span className="text-destructive">Couldn&apos;t publish. {last.errorCode ? ERROR_TEXT[last.errorCode] : ""}</span>;
  else if (connection && item.status === "SCHEDULED" && item.scheduledAt) note = <span className="text-muted-foreground">Auto-publishes to {target} on {when.format(new Date(item.scheduledAt))}</span>;
  else if (!connection && approved) note = <span className="text-muted-foreground">Connect {channelLabel(item.channel)} in Integrations to publish it.</span>;

  const showButton = connection && approved && !pending && last?.status !== "PUBLISHED";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      {note}
      {showButton &&
        (confirming ? (
          <>
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
