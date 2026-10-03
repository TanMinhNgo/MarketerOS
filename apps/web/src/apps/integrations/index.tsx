"use client";

import { ExternalLink, FolderOpen, Link2, Lock, Plug, Sparkles, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useConnections, useDisconnect, useFacebookPages, useSelectFacebookPage, useStartConnect, type Connection, type Provider } from "@/lib/integrations-api";
import { notify } from "@/lib/notify/notify";
import { useProjects, useUsage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useActiveProject } from "@/stores/active-project";
import { channelColor } from "../content-calendar/channel-colors";
import { CHANNELS } from "../content-studio/channels";

const PROVIDERS: { provider: Provider; channel: Connection["channel"]; name: string; blurb: string }[] = [
  { provider: "facebook", channel: "FACEBOOK", name: "Facebook Page", blurb: "Auto-publish approved posts to a Page you manage, and bring post stats into Reports." },
  { provider: "linkedin", channel: "LINKEDIN", name: "LinkedIn", blurb: "Auto-publish approved posts to your personal profile. LinkedIn doesn't share post stats with apps." },
];
/** Kênh chưa kết nối được: thẻ có nhãn "In development", nút bị khoá. */
const IN_DEVELOPMENT: Record<string, string> = {
  INSTAGRAM: "Every post needs an image, so it comes with the Media Library.",
  TIKTOK: "Posts need a video.",
  YOUTUBE: "Posts need a video.",
  EMAIL: "Sending newsletters through an email service.",
  BLOG: "Publishing to WordPress and other blogs.",
};

/** Mã lỗi backend gắn vào URL khi quay về từ OAuth. */
const RETURN_ERROR: Record<string, string> = {
  INVALID_STATE: "The sign-in link expired or was already used. Please connect again.",
  PLAN_REQUIRED: "Integrations are part of Pro and Max.",
  NO_PAGE: "Your Facebook account doesn't manage any Page. Create a Page or ask for a role on one, then connect again.",
  PROVIDER_ERROR: "The platform didn't finish the sign-in. Please try again.",
};
const STATUS: Record<Connection["status"], { label: string; cls: string }> = {
  CONNECTED: { label: "Connected", cls: "bg-emerald-500/20" },
  EXPIRED: { label: "Expired", cls: "bg-amber-500/20" },
  ERROR: { label: "Needs attention", cls: "bg-destructive/20" },
  REVOKED: { label: "Disconnected", cls: "bg-muted" },
};

function Message({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

/** Facebook có nhiều Page: chọn một Page cho dự án (session do backend tạo, sống 10 phút). */
function PagePicker({ projectId, session, onClose }: Readonly<{ projectId: string; session: string; onClose: () => void }>) {
  const pages = useFacebookPages(projectId, session);
  const select = useSelectFacebookPage(projectId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a Facebook Page</DialogTitle>
          <DialogDescription>MarketOS will post to this Page for the current project.</DialogDescription>
        </DialogHeader>
        {pages.isPending && <p className="text-sm text-muted-foreground">Loading Pages…</p>}
        {pages.error && <p className="text-sm text-destructive">{errorMessage(pages.error)} The choice may have expired; connect again.</p>}
        <ul className="space-y-1.5">
          {pages.data?.items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={select.isPending}
                onClick={() =>
                  select.mutate(
                    { session, pageId: p.id },
                    {
                      onSuccess: (c) => {
                        notify.success(`Connected ${c.displayName}`, { description: "Approved, scheduled posts for Facebook will publish here." });
                        onClose();
                      },
                      onError: (e) => notify.apiError("Couldn't connect the Page", e),
                    },
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left text-sm hover:bg-accent disabled:opacity-60"
              >
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh đại diện Page từ CDN của Facebook
                  <img src={p.avatarUrl} alt="" className="size-8 rounded-full" />
                ) : (
                  <span className="size-8 rounded-full bg-muted" aria-hidden="true" />
                )}
                <span className="font-medium">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderCard({ projectId, p, connection }: Readonly<{ projectId: string; p: (typeof PROVIDERS)[number]; connection?: Connection }>) {
  const start = useStartConnect(projectId);
  const disconnect = useDisconnect(projectId);
  const [confirming, setConfirming] = useState(false);
  const usable = connection?.status === "CONNECTED";
  const connect = () => start.mutate(p.provider, { onError: (e) => notify.apiError(`Couldn't connect ${p.name}`, e) });

  return (
    <article aria-label={p.name} className="rounded-2xl border-2 border-[#3B2A4A]/40 bg-card p-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 size-3 shrink-0 rounded-full" style={{ background: channelColor(p.channel) }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{p.name}</h3>
          <p className="text-xs text-muted-foreground">{p.blurb}</p>
        </div>
        {connection && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS[connection.status].cls)}>{STATUS[connection.status].label}</span>}
      </header>

      {connection && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 p-2 text-sm">
          {connection.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh đại diện tài khoản từ CDN của nền tảng
            <img src={connection.avatarUrl} alt="" className="size-7 rounded-full" />
          ) : (
            <Link2 className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{connection.displayName}</span>
          {connection.externalUrl && (
            <a href={connection.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
              Open <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {connection && !usable && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Posting is paused until you reconnect this account.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {(!connection || !usable) && (
          <Button size="sm" disabled={start.isPending} onClick={connect}>
            <Plug /> {connection ? "Reconnect" : "Connect"}
          </Button>
        )}
        {connection &&
          (confirming ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                disabled={disconnect.isPending}
                onClick={() =>
                  disconnect.mutate(connection.id, {
                    onSuccess: () => notify.success(`Disconnected ${connection.displayName}`, { description: "Posts already published stay where they are." }),
                    onError: (e) => notify.apiError("Couldn't disconnect", e),
                  })
                }
              >
                Disconnect
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              <Unplug /> Disconnect
            </Button>
          ))}
      </div>
      {confirming && <p className="mt-1 text-xs text-muted-foreground">Scheduled posts for this channel stop publishing. Published posts and their history are kept.</p>}
    </article>
  );
}

function DevCard({ channel, name, why }: Readonly<{ channel: string; name: string; why?: string }>) {
  return (
    <article aria-label={name} className="rounded-2xl border-2 border-dashed border-[#3B2A4A]/30 bg-card/70 p-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 size-3 shrink-0 rounded-full" style={{ background: channelColor(channel) }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{name}</h3>
          <p className="text-xs text-muted-foreground">{why}</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">In development</span>
      </header>
      <Button className="mt-3" size="sm" variant="outline" disabled>
        <Plug /> Connect
      </Button>
    </article>
  );
}

function ProjectIntegrations({ projectId, name, session, onPicked }: Readonly<{ projectId: string; name: string; session: string | null; onPicked: () => void }>) {
  const list = useConnections(projectId);
  const byChannel = (ch: string) => list.data?.items.find((c) => c.channel === ch);

  return (
    <div className="mx-auto w-11/12 space-y-4 py-5">
      <header>
        <h2 className="font-display text-xl font-bold">Integrations · {name}</h2>
        <p className="text-sm text-muted-foreground">Connect one account per channel. Only approved posts are ever published, at the time you scheduled them or when you press Publish now.</p>
      </header>
      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {list.error && <p className="text-sm text-destructive">{errorMessage(list.error)}</p>}
      {list.data && (
        <div className="space-y-3">
          {CHANNELS.map(({ value, label }) => {
            const p = PROVIDERS.find((x) => x.channel === value);
            return p ? <ProviderCard key={value} projectId={projectId} p={p} connection={byChannel(value)} /> : <DevCard key={value} channel={value} name={label} why={IN_DEVELOPMENT[value]} />;
          })}
        </div>
      )}


      {session && <PagePicker projectId={projectId} session={session} onClose={onPicked} />}
    </div>
  );
}

/** Đọc `?result=` khi quay về từ OAuth một lần, rồi xoá khỏi URL để F5 không báo lại. */
function useOAuthReturn() {
  // App chỉ mount ở client (cửa sổ mở sau khi hydrate) nên đọc URL ngay lúc khởi tạo được.
  const [session, setSession] = useState(() => {
    const q = new URLSearchParams(globalThis.location?.search ?? "");
    return q.get("result") === "pick" ? q.get("session") : null;
  });
  useEffect(() => {
    const q = new URLSearchParams(globalThis.location.search);
    const result = q.get("result");
    if (!result) return;
    if (result === "connected") notify.success("Account connected", { description: "Approved, scheduled posts for this channel will publish automatically." });
    else if (result !== "pick") notify.error("Couldn't connect the account", { description: RETURN_ERROR[q.get("code") ?? ""] ?? RETURN_ERROR.PROVIDER_ERROR });
    globalThis.history.replaceState(null, "", globalThis.location.pathname);
  }, []);
  return [session, () => setSession(null)] as const;
}

function IntegrationsApp() {
  const open = useWindowStore((s) => s.open);
  const usage = useUsage();
  const projects = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const project = projects.data?.items.find((p) => p.id === activeId);
  const [session, clearSession] = useOAuthReturn();

  if (usage.isPending || projects.isPending) return <Message><output className="text-muted-foreground">Loading…</output></Message>;
  if (usage.error) return <Message><p>{errorMessage(usage.error)}</p></Message>;
  if (!usage.data.features.includes("channel_publishing"))
    return (
      <Message>
        <div className="max-w-sm">
          <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">Integrations are part of Pro and Max</p>
          <p className="mt-1 text-muted-foreground">Connect a Facebook Page and LinkedIn, publish approved posts on schedule, and see how they perform in Reports.</p>
          <Button className="mt-3" onClick={() => open("plans-billing")}><Sparkles /> See plans</Button>
        </div>
      </Message>
    );
  if (!project)
    return (
      <Message>
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Accounts are connected per project.</p>
          <Button className="mt-3" onClick={() => open("projects")}><FolderOpen /> Open Projects</Button>
        </div>
      </Message>
    );
  return <ProjectIntegrations key={project.id} projectId={project.id} name={project.name} session={session} onPicked={clearSession} />;
}

export default function App() {
  return (
    <AuthGate>
      <IntegrationsApp />
    </AuthGate>
  );
}
