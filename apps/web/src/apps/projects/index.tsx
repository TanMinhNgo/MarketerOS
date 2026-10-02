"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { notify } from "@/lib/notify/notify";
import { AuthGate } from "@/components/auth-gate";
import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApiError, errorMessage } from "@/lib/api-client";
import { useProjects, useRestoreProject, useTrashProject, useUsage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useWindowStore } from "@/desktop/window-store";
import { useActiveProject } from "@/stores/active-project";
import { ProjectDialog } from "./project-dialog";
import type { ProjectResponse } from "@marketos/shared";

function ProjectsApp() {
  const { data, isPending, error, refetch } = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const setActive = useActiveProject((s) => s.setActive);
  const trash = useTrashProject();
  const restore = useRestoreProject();
  const [editing, setEditing] = useState<ProjectResponse | "new" | null>(null);
  const usage = useUsage().data;
  const openApp = useWindowStore((s) => s.open);
  // Chỉ để báo trước; backend vẫn kiểm tra lại khi tạo (403 PLAN_LIMIT).
  const atLimit = !!usage && usage.usage.projects.used >= usage.usage.projects.limit;

  const moveToTrash = (p: ProjectResponse) =>
    trash.mutate(p.id, {
      onSuccess: () => {
        if (activeId === p.id) setActive(null);
        notify.success(`Moved "${p.name}" to Trash`, { description: "You can restore it from Trash at any time.", action: { label: "Undo", onClick: () => restore.mutate(p.id) }, persist: true, appId: "trash" });
      },
    });

  if (isPending) return <div className="p-6 text-sm text-muted-foreground" role="status">Loading projects…</div>;
  if (error)
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-sm">{error instanceof ApiError ? errorMessage(error) : "Couldn't load projects."}</p>
          <Button className="mt-3" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );

  const projects = data.items;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <h2 className="font-display text-sm font-bold">Your projects</h2>
        <span className="text-xs text-muted-foreground">
          {usage ? `${usage.usage.projects.used} of ${usage.usage.projects.limit} projects` : `${data.total} ${data.total === 1 ? "project" : "projects"}`}
        </span>
        <div className="flex-1" />
        {atLimit && (
          <Button size="sm" variant="ghost" onClick={() => openApp("plans-billing")}>
            {usage.plan === "free" ? "Upgrade for more" : "Limit reached"}
          </Button>
        )}
        <Button size="sm" disabled={atLimit} title={atLimit ? "You've reached your plan's project limit. Move a project to Trash or upgrade." : undefined} onClick={() => setEditing("new")}>
          <Plus /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="font-semibold">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Each project is a folder holding a Brand Brief and content.</p>
            <Button className="mt-3" onClick={() => setEditing("new")}>Create your first project</Button>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] content-start gap-3 overflow-auto p-4">
          {projects.map((p) => {
            const active = p.id === activeId;
            const color = p.color ?? "#6D5BFF";
            return (
              <li key={p.id} className="group relative">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${p.name}${active ? " (selected)" : ""}`}
                  onClick={() => setActive(p.id)}
                  className={cn("flex w-full flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring", active && "bg-accent ring-2 ring-primary")}
                >
                  <span className="grid size-16 place-items-center rounded-2xl border-2 border-[#3B2A4A] text-white shadow-[0_3px_0_rgba(59,42,74,0.35)]" style={{ background: color }}>
                    <ProjectIcon name={p.icon} className="size-8" />
                  </span>
                  <span className="line-clamp-2 break-words text-center text-xs font-semibold leading-tight">{p.name}</span>
                  {active && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Selected</span>}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={`Options for ${p.name}`} className="absolute right-1 top-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil /> Rename / appearance
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => moveToTrash(p)}>
                      <Trash2 /> Move to Trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectDialog
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        project={editing === "new" || editing === null ? undefined : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onCreated={(p) => setActive(p.id)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <ProjectsApp />
    </AuthGate>
  );
}
