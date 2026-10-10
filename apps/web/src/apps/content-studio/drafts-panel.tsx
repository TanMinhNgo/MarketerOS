"use client";

import { UpdateContentSchema, type ContentResponse } from "@marketos/shared";
import { CircleCheck, Copy, FileText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { notify } from "@/lib/notify/notify";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api-client";
import { STATUS_LABEL } from "@/lib/calendar-api";
import { useContents, useDeleteContent, useUpdateContent } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { allChecked, ApproveChecklist } from "./approve-checklist";
import { channelLabel, variantToText } from "./channels";
import { copyText } from "./variant-card";
import { isPublishing, usePublications } from "@/lib/integrations-api";
import { PublishStatus } from "../integrations/publish-status";
import { PostMedia } from "../media-library/post-media";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const STATUS_STYLE = { DRAFT: "bg-amber-500/15 text-amber-700 dark:text-amber-300", READY: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", SCHEDULED: "bg-primary/15 text-primary", DONE: "bg-muted text-muted-foreground" } as const;

function ApproveDialog({ projectId, item, onClose }: { projectId: string; item: ContentResponse; onClose: () => void }) {
  const update = useUpdateContent(projectId);
  const [checks, setChecks] = useState<boolean[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve for publishing</DialogTitle>
          <DialogDescription>{channelLabel(item.channel)} · {item.title}</DialogDescription>
        </DialogHeader>
        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{item.body}</p>
        <ApproveChecklist item={item} value={checks} onChange={setChecks} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={!allChecked(checks) || update.isPending}
            onClick={() => update.mutate({ id: item.id, status: "READY" }, { onSuccess: () => { notify.success("Approved", { description: "Ready to schedule.", action: { label: "Open calendar", appId: "content-calendar" } }); onClose(); } })}
          >
            {update.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ projectId, item, onClose }: { projectId: string; item: ContentResponse; onClose: () => void }) {
  const update = useUpdateContent(projectId);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [hashtags, setHashtags] = useState(item.hashtags);
  const [cta, setCta] = useState(item.cta ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = UpdateContentSchema.safeParse({ title, body, hashtags, cta: cta.trim() ? cta.trim() : null });
    if (!parsed.success) return setError("Title and text can't be empty.");
    update.mutate({ id: item.id, ...parsed.data }, { onSuccess: () => { notify.success("Draft updated"); onClose(); } });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
            <DialogDescription>
              {channelLabel(item.channel)} draft
              {item.status !== "DRAFT" && " · Saving changes sends it back for review; approve it again to publish."}
            </DialogDescription>
          </DialogHeader>
          <Input aria-label="Title" value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); setError(null); }} />
          <Textarea aria-label="Text" value={body} rows={8} maxLength={10000} onChange={(e) => { setBody(e.target.value); setError(null); }} />
          <TagInput value={hashtags} onChange={setHashtags} placeholder="Add hashtag…" max={20} />
          <Input aria-label="Call to action" value={cta} placeholder="Call to action (optional)" maxLength={300} onChange={(e) => setCta(e.target.value)} />
          <PostMedia projectId={projectId} item={item} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Danh sách bản nháp đã lưu của dự án đang chọn. */
export function DraftsPanel({ projectId }: { projectId: string }) {
  const { data, isPending, error, refetch } = useContents(projectId);
  const remove = useDeleteContent(projectId);
  const pubs = usePublications(projectId).data;
  const [editing, setEditing] = useState<ContentResponse | null>(null);
  const [approving, setApproving] = useState<ContentResponse | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <aside aria-label="Saved drafts" className="flex min-h-0 flex-col">
      <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold">
        <FileText className="size-4 text-primary" aria-hidden="true" /> Saved drafts
        {data && <span className="text-xs font-normal text-muted-foreground">({data.total})</span>}
      </h3>
      {isPending && <p role="status" className="text-sm text-muted-foreground">Loading drafts…</p>}
      {error && (
        <div className="text-sm">
          <p>{errorMessage(error)}</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}
      {data && data.items.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet. Generate content, then press Save as draft.</p>}
      <ul className="space-y-2 overflow-y-auto">
        {data?.items.map((c) => (
          <li key={c.id} className="rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{channelLabel(c.channel)}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_STYLE[c.status])}>{STATUS_LABEL[c.status]}</span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">{when.format(new Date(c.createdAt))}</span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold">{c.title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{c.body}</p>
            <PublishStatus projectId={projectId} item={c} className="mt-1.5" />
            <div className="mt-2 flex gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Copy ${c.title}`} onClick={() => copyText(variantToText({ title: c.title, body: c.body, hashtags: c.hashtags, cta: c.cta ?? "" }))}>
                <Copy />
              </Button>
              {c.status === "DRAFT" && (
                <Button variant="outline" size="sm" onClick={() => setApproving(c)}>
                  <CircleCheck /> Approve
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.title}`} title={c.status === "DONE" || isPublishing(pubs, c.id) ? "Published content can't be edited" : undefined} disabled={c.status === "DONE" || isPublishing(pubs, c.id)} onClick={() => setEditing(c)}>
                <Pencil />
              </Button>
              {confirmId === c.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(c.id, { onSuccess: () => { setConfirmId(null); notify.success("Draft deleted"); } })}
                >
                  Confirm delete
                </Button>
              ) : (
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.title}`} onClick={() => setConfirmId(c.id)} onBlur={() => setConfirmId((id) => (id === c.id ? null : id))}>
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {approving && <ApproveDialog projectId={projectId} item={approving} onClose={() => setApproving(null)} />}
      {editing && <EditDialog projectId={projectId} item={editing} onClose={() => setEditing(null)} />}
    </aside>
  );
}
