"use client";

import type { AssistantAction, BrandBriefResponse, ContentResponse } from "@marketos/shared";
import { CalendarClock, Check, FilePlus2, ImagePlus, Images, Palette, PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { channelColor } from "../content-calendar/channel-colors";
import { channelLabel } from "../content-studio/channels";
import { AssetStrip } from "../media-library/asset-thumb";
import { AppliedButNotMarked, useActionStatus } from "./use-assistant";

const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const BRIEF_LABEL: Record<string, string> = {
  product: "Product / service",
  audience: "Target audience",
  tone: "Tone of voice",
  language: "Content language",
  businessAddress: "Business address",
  keyMessages: "Key messages",
  avoidWords: "Words to avoid",
  samplePosts: "Sample posts",
  brandColors: "Brand colors",
  visualStyle: "Visual style",
};

const show = (key: string, v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "language" && typeof v === "string" && v in LANGUAGES) return LANGUAGES[v as keyof typeof LANGUAGES].label;
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return typeof v === "string" ? v : JSON.stringify(v);
};

function Diff({ label, before, after }: Readonly<{ label: string; before?: string; after: string }>) {
  return (
    <div className="text-xs">
      <p className="font-semibold">{label}</p>
      {before !== undefined && before !== after && <p className="line-clamp-3 whitespace-pre-wrap text-destructive line-through">{before}</p>}
      <p className="line-clamp-6 whitespace-pre-wrap">{after}</p>
    </div>
  );
}

const SHAPE = { "1024x1024": "Square", "1536x1024": "Landscape", "1024x1536": "Portrait" } as const;

/** Ảnh kèm bài trong đề xuất: ảnh có sẵn (thu nhỏ) và/hoặc ảnh sẽ tạo bằng AI (mô tả). */
function ImagesPreview({ projectId, ids, prompt, replace }: Readonly<{ projectId: string; ids?: string[]; prompt?: string; replace?: boolean }>) {
  if (!ids?.length && !prompt) return null;
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold">{replace ? "Replace images with" : "Images"}</p>
      {!!ids?.length && <AssetStrip projectId={projectId} ids={ids} />}
      {prompt && (
        <p className="flex gap-1">
          <ImagePlus className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>New AI image: {prompt}</span>
        </p>
      )}
    </div>
  );
}

/** Tóm tắt hành động: tiêu đề + phần xem trước (cũ → mới khi sửa). */
function preview(projectId: string, action: AssistantAction, contents: ContentResponse[], brief: BrandBriefResponse | null | undefined) {
  const targetId = action.type === "generate_image" ? action.attachToContentId : "contentId" in action ? action.contentId : undefined;
  const target = targetId ? contents.find((c) => c.id === targetId) : undefined;
  const name = target ? `“${target.title}”` : "a saved post";
  // Kênh của bài: bài mới lấy từ action, sửa/lên lịch lấy từ bài đang có.
  const channel = action.type === "create_draft" ? action.channel : target?.channel;
  const card = (() => {
    switch (action.type) {
      case "create_draft":
        return {
          icon: FilePlus2,
          title: "New draft",
          body: (
            <>
              <Diff label={action.title} after={[action.body, action.hashtags?.join(" "), action.cta].filter(Boolean).join("\n\n")} />
              <ImagesPreview projectId={projectId} ids={action.assetIds} prompt={action.imagePrompt} />
            </>
          ),
        };
      case "edit_content":
        return {
          icon: PenLine,
          title: `Edit ${name}`,
          body: (
            <>
              {(["title", "body", "hashtags", "cta"] as const)
                .filter((f) => f in action)
                .map((f) => <Diff key={f} label={f === "cta" ? "Call to action" : f[0].toUpperCase() + f.slice(1)} before={target ? show(f, target[f]) : undefined} after={show(f, action[f])} />)}
              <ImagesPreview projectId={projectId} ids={action.assetIds} prompt={action.imagePrompt} replace={action.assetMode === "replace"} />
            </>
          ),
        };
      case "schedule":
        return {
          icon: CalendarClock,
          title: `Schedule ${name}`,
          body: <Diff label="Post on" before={target?.scheduledAt ? when.format(new Date(target.scheduledAt)) : undefined} after={when.format(new Date(action.scheduledAt))} />,
        };
      case "update_brief":
        return {
          icon: Palette,
          title: "Update Brand Brief",
          body: Object.entries(action.changes).map(([k, v]) => (
            <Diff key={k} label={BRIEF_LABEL[k] ?? k} before={brief ? show(k, brief[k as keyof BrandBriefResponse]) : undefined} after={show(k, v)} />
          )),
        };
      case "generate_image":
        return {
          icon: ImagePlus,
          title: target ? `Create an image for ${name}` : "Create an image",
          body: <Diff label={`${SHAPE[action.size]} image${action.name ? ` · ${action.name}` : ""}`} after={action.prompt} />,
        };
      case "attach_media":
        return {
          icon: Images,
          title: `${action.mode === "replace" ? "Replace images on" : "Add images to"} ${name}`,
          body: <AssetStrip projectId={projectId} ids={action.assetIds} />,
        };
    }
  })();
  return { ...card, channel };
}

const NOTE: Partial<Record<AssistantAction["type"], string>> = {
  create_draft: "Saved as Needs review. You still approve it before scheduling.",
  edit_content: "If this post was approved, it goes back to Needs review.",
  generate_image: "Uses 1 AI image from this month's limit. The image is saved to the Media Library.",
  attach_media: "If this post was approved, it goes back to Needs review.",
};

/** Hành động assistant đề xuất: không có gì chạy cho tới khi người dùng bấm Apply. */
export function ActionCard({
  projectId,
  messageId,
  action,
  contents,
  brief,
}: Readonly<{
  projectId: string;
  messageId: string;
  action: AssistantAction;
  contents: ContentResponse[];
  brief: BrandBriefResponse | null | undefined;
}>) {
  const status = useActionStatus(projectId, messageId);
  const { icon: Icon, title, body, channel } = preview(projectId, action, contents, brief);
  const appliedAnyway = status.error instanceof AppliedButNotMarked;
  const settled = action.status !== "proposed" || appliedAnyway;

  return (
    <article aria-label={title} className={cn("msg-in origin-top-left rounded-xl border bg-background p-3", settled && "opacity-75")}>
      <header className="mb-2 flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h4>
        {channel && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
            <span className="size-2 rounded-full" style={{ background: channelColor(channel) }} aria-hidden="true" />
            {channelLabel(channel)}
          </span>
        )}
        {(action.status === "applied" || appliedAnyway) && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">Applied</span>}
        {action.status === "dismissed" && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">Dismissed</span>}
      </header>
      <div className="space-y-2">{body}</div>
      {!settled && NOTE[action.type] && <p className="mt-2 text-[11px] text-muted-foreground">{NOTE[action.type]}</p>}
      {!settled && "imagePrompt" in action && action.imagePrompt && <p className="text-[11px] text-muted-foreground">Creating the new image uses 1 AI image from this month&apos;s limit.</p>}
      {status.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {appliedAnyway ? status.error.message : errorMessage(status.error)}
        </p>
      )}
      {!settled && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={status.isPending} onClick={() => status.mutate({ action, status: "applied" })}>
            <Check /> {status.isPending && status.variables?.status === "applied" ? "Applying…" : "Apply"}
          </Button>
          <Button size="sm" variant="ghost" disabled={status.isPending} onClick={() => status.mutate({ action, status: "dismissed" })}>
            <X /> Dismiss
          </Button>
        </div>
      )}
    </article>
  );
}
