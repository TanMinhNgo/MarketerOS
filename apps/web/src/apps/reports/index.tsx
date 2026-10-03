"use client";

import { ContentListResponseSchema, type ContentResponse } from "@marketos/shared";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChartNoAxesColumn, Download, FolderOpen, Layers, PenLine, Sparkles, TrendingUp } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { api, errorMessage } from "@/lib/api-client";
import { STATUS_LABEL, type ContentStatus } from "@/lib/calendar-api";
import { keys, useProjects, useUsage } from "@/lib/queries";
import { normalize } from "@/desktop/search/search-index";
import { latestFor, metric, useCanPublish, usePublications, type Publication } from "@/lib/integrations-api";
import { notify } from "@/lib/notify/notify";
import { useActiveProject } from "@/stores/active-project";
import { channelColor } from "../content-calendar/channel-colors";
import { channelLabel } from "../content-studio/channels";
import { Card, Meter } from "@/components/panel";
import { downloadCsv, postsCsv } from "./export";
import { summarize, type ContentSummary } from "./summary";

const PAGE = 100;
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Tải mọi bài của dự án (API phân trang tối đa 100/trang): trang 1 cho biết tổng, các trang còn lại tải song song. */
// ponytail: tải hết rồi đếm ở client; dự án hàng nghìn bài thì cần endpoint thống kê ở backend.
async function fetchAll(projectId: string): Promise<ContentResponse[]> {
  const page = (n: number) => api(`/api/projects/${projectId}/contents?page=${n}&limit=${PAGE}`, ContentListResponseSchema);
  const first = await page(1);
  const rest = await Promise.all(Array.from({ length: Math.ceil(first.total / PAGE) - 1 }, (_, i) => page(i + 2)));
  return [first, ...rest].flatMap((p) => p.items);
}

function Message({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

function Tile({ label, value, hint, onClick }: Readonly<{ label: string; value: number; hint: string; onClick?: () => void }>) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border-2 border-[#3B2A4A]/40 bg-card p-4 text-left transition-colors hover:bg-accent">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

/** Một hàng của biểu đồ thanh ngang: nhãn, thanh (tỉ lệ theo giá trị lớn nhất), số. */
function Bar({ label, value, max, color, note, empty }: Readonly<{ label: React.ReactNode; value: number; max: number; color: string; note?: string; empty?: string }>) {
  return (
    <li className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm" title={note}>
      <span className="truncate">{label}</span>
      <span className="h-3 overflow-hidden rounded-full bg-muted">
        {value > 0 && <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />}
      </span>
      <span className="text-right font-semibold tabular-nums">{value}</span>
      {note && <span className="col-start-2 col-end-4 -mt-1.5 text-xs text-muted-foreground">{note}</span>}
      {empty && value === 0 && <span className="col-start-2 col-end-4 -mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">{empty}</span>}
    </li>
  );
}

const breakdown = (s: Record<ContentStatus, number>) =>
  (Object.keys(STATUS_LABEL) as ContentStatus[])
    .filter((k) => s[k])
    .map((k) => `${s[k]} ${STATUS_LABEL[k].toLowerCase()}`)
    .join(" · ");

function weekLabel(i: number, start: Date) {
  if (i === 0) return "This week";
  if (i === 1) return "Next week";
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return `${day.format(start)} – ${day.format(end)}`;
}

const COLS = [
  ["impressions", "Views"],
  ["reach", "Unique views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["shares", "Shares"],
] as const;
const num = new Intl.NumberFormat("en-US");

/** Số liệu bài đã đăng (lần đo mới nhất). Chỉ Facebook có số liệu; LinkedIn không chia sẻ với app. */
function Performance({ projectId }: Readonly<{ projectId: string }>) {
  const open = useWindowStore((st) => st.open);
  const canPublish = useCanPublish();
  const pubs = usePublications(projectId);
  const published = pubs.data?.filter((p) => p.status === "PUBLISHED") ?? [];
  const total = (k: (typeof COLS)[number][0]) => published.reduce((n, p) => n + (metric(p.latestMetric?.[k]) ?? 0), 0);
  const cell = (v: string | null | undefined) => {
    const n = metric(v);
    return n == null ? "—" : num.format(n);
  };

  let body: React.ReactNode;
  if (!canPublish) body = <p className="text-sm text-muted-foreground">Part of Pro and Max: connect Facebook or LinkedIn, publish on schedule, and see each post&apos;s numbers here.</p>;
  else if (pubs.isPending) body = <p className="text-sm text-muted-foreground">Loading…</p>;
  else if (pubs.error) body = <p className="text-sm text-destructive">{errorMessage(pubs.error)}</p>;
  else if (!published.length)
    body = (
      <p className="text-sm text-muted-foreground">
        Nothing published from MarketOS yet. Connect a channel, then approved posts publish at their scheduled time.{" "}
        <Button size="xs" variant="link" className="h-auto p-0" onClick={() => open("integrations")}>Open Integrations</Button>
      </p>
    );
  else
    body = (
      <>
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-5">
          {COLS.map(([k, label]) => (
            <div key={k} className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display text-2xl font-bold tabular-nums">{num.format(total(k))}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Post</th>
                <th scope="col" className="px-3 py-2 font-semibold">Published</th>
                {COLS.map(([k, label]) => <th key={k} scope="col" className="px-3 py-2 text-right font-semibold">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {published.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="max-w-64 px-3 py-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: channelColor(p.channel) }} title={channelLabel(p.channel)} aria-hidden="true" />
                      {p.externalUrl ? <a href={p.externalUrl} target="_blank" rel="noopener noreferrer" className="truncate underline">{p.title}</a> : <span className="truncate">{p.title}</span>}
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2">{p.publishedAt ? day.format(new Date(p.publishedAt)) : "—"}</td>
                  {COLS.map(([k]) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums" title={p.channel === "LINKEDIN" ? "LinkedIn doesn't share post stats" : undefined}>{cell(p.latestMetric?.[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Facebook numbers refresh every 6 hours for posts from the last 30 days. LinkedIn doesn&apos;t share post stats with apps, so its rows show —.</p>
      </>
    );

  return <Card icon={TrendingUp} title="Content performance">{body}</Card>;
}

function Overview({ projectId, s }: Readonly<{ projectId: string; s: ContentSummary }>) {
  const open = useWindowStore((st) => st.open);
  const usage = useUsage().data?.usage;
  const channelMax = Math.max(1, ...s.channels.map((c) => c.total));
  const weekMax = Math.max(1, ...s.weeks.map((w) => w.count));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-5">
        <Tile label="All posts" value={s.total} hint="Saved in this project" onClick={() => open("content-studio")} />
        <Tile label="Needs review" value={s.byStatus.DRAFT} hint="Approve before scheduling" onClick={() => open("content-studio")} />
        <Tile label="Approved, no date" value={s.readyUnscheduled} hint="Ready to put on the calendar" onClick={() => open("content-calendar")} />
        <Tile label="Scheduled ahead" value={s.upcoming} hint="Planned from now on" onClick={() => open("content-calendar")} />
        <Tile label="Done" value={s.byStatus.DONE} hint="Marked as Done" onClick={() => open("content-calendar")} />
      </div>

      <Card icon={Layers} title="Posts by channel">
        <ul className="space-y-3">
          {s.channels.map((c) => (
            <Bar
              key={c.channel}
              label={
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: channelColor(c.channel) }} aria-hidden="true" />
                  {channelLabel(c.channel)}
                </span>
              }
              value={c.total}
              max={channelMax}
              color={channelColor(c.channel)}
              note={breakdown(c.byStatus)}
            />
          ))}
        </ul>
      </Card>

      <Card icon={CalendarRange} title="Next 4 weeks" action={<Button size="xs" variant="ghost" onClick={() => open("content-calendar")}>Open calendar</Button>}>
        <ul className="space-y-3">
          {s.weeks.map((w, i) => (
            <Bar key={w.start.toISOString()} label={weekLabel(i, w.start)} value={w.count} max={weekMax} color="#6D5BFF" empty="Nothing scheduled yet" />
          ))}
        </ul>
      </Card>

      {usage && (
        <Card icon={ChartNoAxesColumn} title="AI usage this month" action={<Button size="xs" variant="ghost" onClick={() => open("plans-billing")}>Plans &amp; Billing</Button>}>
          <div className="space-y-4">
            <Meter label="AI generations" used={usage.text.used} limit={usage.text.limit} hint="Across all projects." />
            {usage.assistant && <Meter label="AI Assistant messages" used={usage.assistant.used} limit={usage.assistant.limit} hint="Across all projects." />}
            {usage.automationRuns && <Meter label="Automation runs" used={usage.automationRuns.used} limit={usage.automationRuns.limit} hint="Across all projects." />}
          </div>
        </Card>
      )}

      <Performance projectId={projectId} />
    </>
  );
}

/** Tải file CSV mọi bài của dự án; Excel / Google Sheets mở trực tiếp. */
function exportPosts(name: string, items: ContentResponse[], published: (contentId: string) => Publication | undefined) {
  const slug = normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  downloadCsv(`marketos-${slug}-posts-${new Date().toISOString().slice(0, 10)}.csv`, postsCsv(items, published));
  notify.success("Report exported", { description: `${items.length} posts. Open the file in Excel or Google Sheets.` });
}

function ProjectReport({ projectId, name }: Readonly<{ projectId: string; name: string }>) {
  const open = useWindowStore((s) => s.open);
  // Nằm dưới key contents(projectId) nên lưu / sửa / xoá bài ở app khác cũng làm mới báo cáo.
  const all = useQuery({ queryKey: [...keys.contents(projectId), "all"], queryFn: () => fetchAll(projectId) });
  const pubs = usePublications(projectId);

  return (
    <div className="@container mx-auto w-11/12 space-y-4 py-5">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold">Reports · {name}</h2>
          <p className="text-sm text-muted-foreground">Where this project&apos;s posts stand, and what&apos;s coming up.</p>
        </div>
        <Button variant="outline" disabled={!all.data?.length} onClick={() => all.data && exportPosts(name, all.data, (id) => latestFor(pubs.data, id))}>
          <Download /> Export CSV
        </Button>
      </header>
      {all.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {all.error && (
        <div className="text-sm">
          <p className="text-destructive">{errorMessage(all.error)}</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => all.refetch()}>Try again</Button>
        </div>
      )}
      {all.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm">
          <PenLine className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">No posts yet</p>
          <p className="mt-1 text-muted-foreground">Write and save a few posts, and this report fills in.</p>
          <Button className="mt-3" onClick={() => open("content-studio")}><Sparkles /> Open Content Studio</Button>
        </div>
      )}
      {!!all.data?.length && <Overview projectId={projectId} s={summarize(all.data)} />}
    </div>
  );
}

function ReportsApp() {
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
          <p className="mt-1 text-muted-foreground">Choose a project to see its report.</p>
          <Button className="mt-3" onClick={() => open("projects")}><FolderOpen /> Open Projects</Button>
        </div>
      </Message>
    );
  return <ProjectReport key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <ReportsApp />
    </AuthGate>
  );
}
