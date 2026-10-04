"use client";

import { AssetUrlResponseSchema, type GenerateImageInput } from "@marketos/shared";
import { Download, FolderOpen, ImagePlus, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWindowStore } from "@/desktop/window-store";
import { api, errorMessage } from "@/lib/api-client";
import { formatBytes, UPLOAD_TYPES, useAssets, useDeleteAsset, useGenerateImage, useUpload, type Asset } from "@/lib/media-api";
import { notify } from "@/lib/notify/notify";
import { useBrief, useProjects, useUsage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useActiveProject } from "@/stores/active-project";
import { AssetThumb } from "./asset-thumb";

const SIZES: Record<GenerateImageInput["size"], string> = { "1024x1024": "Square (1:1)", "1536x1024": "Landscape (3:2)", "1024x1536": "Portrait (2:3)" };
const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function Message({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

/** Tạo ảnh AI. `defaultPrompt` để điền sẵn (vd. từ nội dung bài), `onCreated` nhận ảnh vừa tạo. */
export function GenerateDialog({ projectId, onClose, defaultPrompt = "", onCreated }: Readonly<{ projectId: string; onClose: () => void; defaultPrompt?: string; onCreated?: (a: Asset) => void }>) {
  const gen = useGenerateImage(projectId);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [name, setName] = useState("");
  const [size, setSize] = useState<GenerateImageInput["size"]>("1024x1024");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    gen.mutate(
      { prompt: prompt.trim(), size, ...(name.trim() ? { name: name.trim() } : {}) },
      {
        onSuccess: (a) => {
          notify.success("Image ready", { description: `"${a.name}" is in the Media Library.` });
          onCreated?.(a);
          onClose();
        },
        onError: (err) => notify.apiError("Couldn't create the image", err),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !gen.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create an image with AI</DialogTitle>
            <DialogDescription>It follows the visual style and brand colors in your Brand Brief. One image uses one image credit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="img-prompt">Describe the image</Label>
            <Textarea id="img-prompt" rows={4} maxLength={2000} value={prompt} placeholder="e.g. A cup of iced coffee on a wooden table, morning light" onChange={(e) => setPrompt(e.target.value)} disabled={gen.isPending} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="img-size">Shape</Label>
              <Select value={size} onValueChange={(v) => setSize(v as GenerateImageInput["size"])} disabled={gen.isPending}>
                <SelectTrigger id="img-size" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SIZES) as GenerateImageInput["size"][]).map((k) => <SelectItem key={k} value={k}>{SIZES[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-name">Name (optional)</Label>
              <Input id="img-name" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} disabled={gen.isPending} />
            </div>
          </div>
          {gen.isPending && <p className="text-xs text-muted-foreground" aria-live="polite">Creating your image… this can take up to a minute.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={gen.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!prompt.trim() || gen.isPending}><Sparkles /> {gen.isPending ? "Creating…" : "Create image"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssetDialog({ projectId, asset, onClose }: Readonly<{ projectId: string; asset: Asset; onClose: () => void }>) {
  const remove = useDeleteAsset(projectId);
  const [confirming, setConfirming] = useState(false);
  // Tải về bằng URL ký mới (URL đang hiển thị có thể sắp hết hạn).
  const download = async () => {
    const { url } = await api(`/api/projects/${projectId}/assets/${asset.id}/url`, AssetUrlResponseSchema);
    globalThis.open(url, "_blank", "noopener");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{asset.name}</DialogTitle>
          <DialogDescription>
            {[asset.width && asset.height ? `${asset.width}×${asset.height}` : null, formatBytes(asset.byteSize), day.format(new Date(asset.createdAt)), asset.generationId ? "Created with AI" : "Uploaded"].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <AssetThumb projectId={projectId} asset={asset} fit="contain" className="h-[55vh] max-h-[520px] bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)] bg-[length:20px_20px]" />
        <DialogFooter className="gap-2 sm:justify-between">
          {confirming ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(asset.id, {
                    onSuccess: () => {
                      notify.success(`Deleted "${asset.name}"`);
                      onClose();
                    },
                    onError: (e) => notify.apiError("Couldn't delete the image", e),
                  })
                }
              >
                Delete for good
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}><Trash2 /> Delete</Button>
          )}
          <Button variant="outline" onClick={() => void download().catch((e) => notify.apiError("Couldn't download", e))}><Download /> Download</Button>
        </DialogFooter>
        {confirming && <p className="text-xs text-muted-foreground">If a post still uses this image, remove it from the post first.</p>}
      </DialogContent>
    </Dialog>
  );
}

function Library({ projectId, name }: Readonly<{ projectId: string; name: string }>) {
  const open = useWindowStore((s) => s.open);
  const assets = useAssets(projectId);
  const brief = useBrief(projectId);
  const images = useUsage().data?.usage.images;
  const upload = useUpload(projectId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState<Asset | null>(null);
  const [dragging, setDragging] = useState(false);
  const items = assets.data?.pages.flatMap((p) => p.items) ?? [];
  const outOfImages = !!images && images.used >= images.limit;

  // Upload lần lượt từng file (backend nhận 1 file/lần); báo riêng từng lỗi.
  const uploadAll = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f); // NOSONAR: tuần tự để không dồn nhiều upload 10 MB cùng lúc
        notify.success(`Uploaded "${f.name}"`);
      } catch (e) {
        notify.apiError(`Couldn't upload "${f.name}"`, e);
      }
    }
  };

  return (
    <section
      aria-label="Media Library"
      className={cn("mx-auto min-h-full w-11/12 space-y-4 py-5", dragging && "rounded-2xl outline-2 outline-dashed outline-primary")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void uploadAll(e.dataTransfer.files);
      }}
    >
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold">Media Library · {name}</h2>
          <p className="text-sm text-muted-foreground">
            Images for this project&apos;s posts. Drop files here to upload.
            {images && ` ${images.used} / ${images.limit} AI images used this month.`}
          </p>
        </div>
        <input ref={fileInput} type="file" accept={UPLOAD_TYPES.join(",")} multiple hidden onChange={(e) => e.target.files && void uploadAll(e.target.files).finally(() => (e.target.value = ""))} />
        <Button variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
          <Upload /> {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
        <Button disabled={brief.data === null || outOfImages} title={outOfImages ? "You've used this month's AI images" : undefined} onClick={() => setGenerating(true)}>
          <Sparkles /> Create with AI
        </Button>
      </header>

      {brief.data === null && (
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
          Creating images uses your Brand Brief&apos;s visual style, so this project needs one first.{" "}
          <Button size="xs" variant="link" className="h-auto p-0" onClick={() => open("brand-brief")}>Open Brand Brief</Button>
        </p>
      )}
      {outOfImages && (
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
          You&apos;ve used this month&apos;s {images?.limit} AI images. Uploading still works.{" "}
          <Button size="xs" variant="link" className="h-auto p-0" onClick={() => open("plans-billing")}>See plans</Button>
        </p>
      )}

      {assets.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {assets.error && <p className="text-sm text-destructive">{errorMessage(assets.error)}</p>}
      {assets.data && items.length === 0 && (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm">
          <ImagePlus className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">No images yet</p>
          <p className="mt-1 text-muted-foreground">Upload PNG, JPEG or WebP images (up to 10 MB), or create one with AI.</p>
        </div>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {items.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setViewing(a)} className="group block w-full text-left">
              <AssetThumb projectId={projectId} asset={a} className="aspect-square transition-transform group-hover:scale-[1.02]" />
              <p className="mt-1 truncate text-xs font-medium">{a.name}</p>
            </button>
          </li>
        ))}
      </ul>
      {assets.hasNextPage && (
        <Button variant="outline" size="sm" disabled={assets.isFetchingNextPage} onClick={() => assets.fetchNextPage()}>Load more</Button>
      )}

      {generating && <GenerateDialog projectId={projectId} onClose={() => setGenerating(false)} />}
      {viewing && <AssetDialog projectId={projectId} asset={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

function MediaApp() {
  const open = useWindowStore((s) => s.open);
  const projects = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const project = projects.data?.items.find((p) => p.id === activeId);

  if (projects.isPending) return <Message><output className="text-muted-foreground">Loading…</output></Message>;
  if (projects.error) return <Message><p>{errorMessage(projects.error)}</p></Message>;
  if (!project)
    return (
      <Message>
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Each project keeps its own images.</p>
          <Button className="mt-3" onClick={() => open("projects")}><FolderOpen /> Open Projects</Button>
        </div>
      </Message>
    );
  return <Library key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <MediaApp />
    </AuthGate>
  );
}
