"use client";

import { PLAN_LIMITS, type Automation, type AutomationRun } from "@marketos/shared";
import { CalendarClock, ChevronDown, FileText, FolderOpen, Lock, MessageSquare, Pencil, Play, Plus, Sparkles, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useBrief, useProjects, useUsage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify/notify";
import { useActiveProject } from "@/stores/active-project";
import { AutomationForm } from "./automation-form";
import { describeSchedule, TYPES } from "./schedule";
import { useAutomations, useDeleteAutomation, useRunNow, useRuns, useSaveAutomation } from "./use-automations";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmt = (iso: string | null) => (iso ? when.format(new Date(iso)) : "—");

function Message({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

const RUN_STATUS: Record<AutomationRun["status"], { label: string; cls: string }> = {
  queued: { label: "Waiting", cls: "bg-muted" },
  running: { label: "Running", cls: "bg-sky-500/20" },
  succeeded: { label: "Done", cls: "bg-emerald-500/20" },
  failed: { label: "Failed", cls: "bg-destructive/20" },
  skipped: { label: "Skipped", cls: "bg-amber-500/20" },
};

function Runs({ projectId, automationId }: Readonly<{ projectId: string; automationId: string }>) {
  const open = useWindowStore((s) => s.open);
  const runs = useRuns(projectId, automationId);
  if (runs.isPending) return <p className="text-xs text-muted-foreground">Loading history…</p>;
  if (runs.error) return <p className="text-xs text-destructive">{errorMessage(runs.error)}</p>;
  const items = runs.data.pages.flatMap((p) => p.items);
  if (!items.length) return <p className="text-xs text-muted-foreground">No runs yet. Press Run now to try it.</p>;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id} className="rounded-lg border p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 font-bold", RUN_STATUS[r.status].cls)}>{RUN_STATUS[r.status].label}</span>
            <span className="text-muted-foreground">{fmt(r.finishedAt ?? r.startedAt ?? r.createdAt)} · {r.trigger === "manual" ? "Run now" : "Scheduled"}</span>
          </div>
          {r.summary && <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{r.summary}</p>}
          {r.error && <p className="mt-1 text-destructive">{r.error.message}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {r.createdContentIds.length > 0 && (
              <Button size="xs" variant="outline" onClick={() => open("content-studio")}><FileText /> {r.createdContentIds.length} draft{r.createdContentIds.length > 1 ? "s" : ""} to review</Button>
            )}
            {r.scheduledContentIds.length > 0 && (
              <Button size="xs" variant="outline" onClick={() => open("content-calendar")}><CalendarClock /> {r.scheduledContentIds.length} scheduled</Button>
            )}
            {r.assistantMessageId && (
              <Button size="xs" variant="outline" onClick={() => open("ai-assistant")}><MessageSquare /> Open in AI Assistant</Button>
            )}
          </div>
        </li>
      ))}
      {runs.hasNextPage && (
        <Button size="xs" variant="ghost" disabled={runs.isFetchingNextPage} onClick={() => runs.fetchNextPage()}>Older runs</Button>
      )}
    </ul>
  );
}

function AutomationCard({ projectId, automation: a, onEdit }: Readonly<{ projectId: string; automation: Automation; onEdit: () => void }>) {
  const [showRuns, setShowRuns] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = useSaveAutomation(projectId);
  const remove = useDeleteAutomation(projectId);
  const run = useRunNow(projectId, a.id);

  return (
    <article aria-label={a.name} className={cn("rounded-xl border bg-card p-3", !a.enabled && "opacity-75")}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{a.name}</h3>
          <p className="text-xs text-muted-foreground">{TYPES[a.type].label} · {describeSchedule(a.schedule)}</p>
          <p className="text-xs text-muted-foreground">
            {a.enabled ? `Next run ${fmt(a.nextRunAt)}` : "Paused"} · Last run {fmt(a.lastRunAt)}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" role="switch" className="size-4 accent-primary" checked={a.enabled} disabled={toggle.isPending} onChange={(e) => toggle.mutate({ id: a.id, input: { enabled: e.target.checked } }, { onError: (e) => notify.apiError("Couldn't change the automation", e), onSuccess: (x) => notify.success(x.enabled ? `"${x.name}" is on` : `"${x.name}" is paused`, { description: x.enabled ? describeSchedule(x.schedule) : "It won't run until you turn it back on." }) })} />
          On
        </label>
      </header>


      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={!a.enabled || run.isPending} title={a.enabled ? undefined : "Turn it on to run it"} onClick={() => run.mutate(undefined, { onError: (e) => notify.apiError("Couldn't start the run", e), onSuccess: () => { setShowRuns(true); notify.info("Run started", { description: "You'll get a notification when it finishes." }); } })}>
          <Play /> {run.isPending ? "Starting…" : "Run now"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}><Pencil /> Edit</Button>
        {confirmDelete ? (
          <>
            <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(a.id, { onError: (e) => notify.apiError("Couldn't delete the automation", e), onSuccess: () => notify.success(`Deleted "${a.name}"`, { description: "Posts and messages it made are kept." }) })}>Delete for good</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" aria-expanded={showRuns} onClick={() => setShowRuns(!showRuns)}>
          History <ChevronDown className={cn("transition-transform", showRuns && "rotate-180")} />
        </Button>
      </div>
      {confirmDelete && <p className="mt-1 text-xs text-muted-foreground">Posts and chat messages it already made stay. Its run history is deleted.</p>}
      {showRuns && <div className="mt-3"><Runs projectId={projectId} automationId={a.id} /></div>}
    </article>
  );
}

function ProjectAutomations({ projectId, name }: Readonly<{ projectId: string; name: string }>) {
  const open = useWindowStore((s) => s.open);
  const list = useAutomations(projectId);
  const brief = useBrief(projectId);
  const usage = useUsage().data?.usage;
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const active = usage?.automations;
  const runs = usage?.automationRuns;

  return (
    <div className="mx-auto w-11/12 space-y-3 py-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">Automations · {name}</h2>
          <p className="text-xs text-muted-foreground">
            {active && `${active.used} / ${active.limit} turned on (all projects)`}
            {active && runs && " · "}
            {runs && `${runs.used} / ${runs.limit} runs this month`}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus /> New automation</Button>
      </header>

      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        Automations never approve, delete or mark posts as Done. New posts wait in Needs review; only approved posts get scheduled. Every run counts, even one that fails or is skipped.
      </p>
      {brief.data === null && (
        <p role="alert" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
          This project has no Brand Brief, so its automations will be skipped.{" "}
          <Button size="xs" variant="link" className="h-auto p-0" onClick={() => open("brand-brief")}>Open Brand Brief</Button>
        </p>
      )}

      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {list.error && <p className="text-sm text-destructive">{errorMessage(list.error)}</p>}
      {list.data?.items.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm">
          <Workflow className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">No automations yet</p>
          <p className="mt-1 text-muted-foreground">For example: write 3 posts every Monday, or fill next week&apos;s calendar with approved posts.</p>
        </div>
      )}
      {list.data?.items.map((a) => <AutomationCard key={a.id} projectId={projectId} automation={a} onEdit={() => setEditing(a)} />)}

      {editing && <AutomationForm projectId={projectId} automation={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AutomationsApp() {
  const open = useWindowStore((s) => s.open);
  const usage = useUsage();
  const projects = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const project = projects.data?.items.find((p) => p.id === activeId);

  if (usage.isPending || projects.isPending) return <Message><output className="text-muted-foreground">Loading…</output></Message>;
  if (usage.error) return <Message><p>{errorMessage(usage.error)}</p></Message>;
  // Quyền do backend xác minh từ Clerk; API cũng trả 403 PLAN_REQUIRED nếu thiếu.
  if (!usage.data.features.includes("automation"))
    return (
      <Message>
        <div className="max-w-sm">
          <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">Automations are part of Max</p>
          <p className="mt-1 text-muted-foreground">Let MarketOS write drafts, fill your calendar with approved posts and send weekly reports on a schedule. You still review everything. Max includes {PLAN_LIMITS.max.automations} automations and {PLAN_LIMITS.max.automationRuns} runs a month.</p>
          <Button className="mt-3" onClick={() => open("plans-billing")}><Sparkles /> See Max</Button>
        </div>
      </Message>
    );
  if (!project)
    return (
      <Message>
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Choose a project to automate.</p>
          <Button className="mt-3" onClick={() => open("projects")}><FolderOpen /> Open Projects</Button>
        </div>
      </Message>
    );
  return <ProjectAutomations key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <AutomationsApp />
    </AuthGate>
  );
}
