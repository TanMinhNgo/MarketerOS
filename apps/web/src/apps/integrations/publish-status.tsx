"use client";

import { PublishEmailSchema, type ContentResponse } from "@marketos/shared";
import { ExternalLink, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContentAssets } from "@/lib/media-api";
import { ERROR_TEXT, isPublishable, latestFor, useCanPublish, useChannelConnection, usePublications, usePublishNow, type Publication } from "@/lib/integrations-api";
import { notify } from "@/lib/notify/notify";
import { cn } from "@/lib/utils";
import { channelLabel } from "../content-studio/channels";
import { AssetThumb } from "../media-library/asset-thumb";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Dòng trạng thái của một bài: đã đăng / đang đăng / lỗi / sẽ tự đăng / chưa kết nối. `target` null = chưa kết nối. */
function statusNote(last: Publication | undefined, target: string | null, item: ContentResponse): React.ReactNode {
  const email = item.channel === "EMAIL";
  // Email: SMTP chấp nhận thư chưa chứng minh đã tới hộp thư; không có link hay số liệu.
  if (last?.status === "PUBLISHED" && email) return <span className="text-emerald-700 dark:text-emerald-300">Accepted by SMTP {last.publishedAt && when.format(new Date(last.publishedAt))}</span>;
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
  if (last?.status === "QUEUED" || last?.status === "PUBLISHING") return <span className="text-sky-700 dark:text-sky-300">{email ? "Sending email…" : `Publishing to ${target ?? channelLabel(item.channel)}…`}</span>;
  if (last?.status === "FAILED" && email) return <span className="text-destructive">Couldn&apos;t send. Check your SMTP provider before sending again; it may already have accepted the email.</span>;
  if (last?.status === "FAILED") return <span className="text-destructive">Couldn&apos;t publish. {last.errorCode ? ERROR_TEXT[last.errorCode] : ""}</span>;
  if (target && email && item.status === "SCHEDULED") return <span className="text-muted-foreground">Emails aren&apos;t sent automatically. Press Send email when it&apos;s time.</span>;
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

/** Email: xem đúng thư sẽ gửi (gửi từ, gửi tới, tiêu đề, nội dung + CTA, không hashtag/ảnh). */
function EmailPreview({ projectId, item, from, to }: Readonly<{ projectId: string; item: ContentResponse; from: string; to: string }>) {
  const media = useContentAssets(projectId, item.id);
  return (
    <div className="w-full space-y-1 rounded-lg border bg-muted/40 p-2.5">
      <p className="font-semibold">This is the email that will be sent</p>
      <p><span className="text-muted-foreground">From:</span> {from}</p>
      <p><span className="text-muted-foreground">To:</span> {to || "—"}</p>
      <p><span className="text-muted-foreground">Subject:</span> {item.title}</p>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap border-t pt-1">{[item.body, item.cta].filter(Boolean).join("\n\n")}</p>
      {!!media.data?.items.length && <p className="text-destructive">Emails are sent as plain text without images. Remove the images from this post to send it.</p>}
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
  // Một lần gửi = một Idempotency-Key: thử lại (mất kết nối) giữ key, mở lại hộp xác nhận thì tạo key mới.
  const [key, setKey] = useState("");
  const [to, setTo] = useState("");
  const media = useContentAssets(projectId, item.id);
  if (!canPublish) return null;
  if (!isPublishable(item.channel)) return null;

  const last = latestFor(pubs.data, item.id);
  const target = connection?.displayName ?? channelLabel(item.channel);
  const approved = item.status === "READY" || item.status === "SCHEDULED";
  const pending = last?.status === "QUEUED" || last?.status === "PUBLISHING";

  const email = item.channel === "EMAIL";
  const recipient = PublishEmailSchema.safeParse({ to: to.trim() });
  const blocked = email && (!recipient.success || !!media.data?.items.length);
  const start = () => {
    setKey(crypto.randomUUID());
    setConfirming(true);
  };
  const run = () =>
    publish.mutate(
      { content: item, key, email: email && recipient.success ? recipient.data : undefined },
      {
        onSuccess: () => {
          setConfirming(false);
          setTo("");
          if (email) notify.info("Sending email…", { description: `To ${recipient.data?.to}. You'll see here when your SMTP provider accepts it.` });
          else notify.info("Publishing…", { description: `Posting to ${target}. You'll see the link here when it's live.` });
        },
        onError: (e) => notify.apiError(email ? "Couldn't send the email" : "Couldn't publish", e),
      },
    );

  const note = statusNote(last, connection ? target : null, item);

  const showButton = connection && approved && !pending && last?.status !== "PUBLISHED";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      {note}
      {showButton &&
        (confirming ? (
          <>
            {email && (
              <div className="w-full space-y-1">
                <Label htmlFor={`to-${item.id}`}>Send to</Label>
                <Input id={`to-${item.id}`} type="email" autoComplete="off" placeholder="reader@example.com" value={to} aria-invalid={!!to && !recipient.success} onChange={(e) => setTo(e.target.value)} />
                {!!to && !recipient.success && <p className="text-destructive">Enter one valid email address.</p>}
              </div>
            )}
            {email ? <EmailPreview projectId={projectId} item={item} from={target} to={to.trim()} /> : <PublishPreview projectId={projectId} item={item} />}
            <Button size="xs" disabled={publish.isPending || blocked} onClick={run}>
              {publish.isPending ? (email ? "Sending…" : "Publishing…") : email ? "Send email" : `Post to ${target} now`}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="xs" variant="outline" onClick={start}>
            <Send /> {email ? "Send email" : "Publish now"}
          </Button>
        ))}
    </div>
  );
}
