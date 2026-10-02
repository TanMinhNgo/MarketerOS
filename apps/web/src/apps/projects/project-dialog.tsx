"use client";

import { CreateProjectSchema, type ProjectResponse } from "@marketos/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_COLORS, PROJECT_ICONS, type ProjectIconKey } from "@/lib/project-meta";
import { useCreateProject, useUpdateProject } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Props {
  /** Có project thì là chế độ sửa, không thì tạo mới. */
  project?: ProjectResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: ProjectResponse) => void;
}

export function ProjectDialog({ project, open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState<ProjectIconKey>((project?.icon as ProjectIconKey) ?? "folder");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProject();
  const update = useUpdateProject();
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreateProjectSchema.safeParse({ name, icon, color });
    if (!parsed.success) {
      setError(name.trim() ? "Name is too long (120 characters max)." : "Enter a project name.");
      return;
    }
    const done = () => onOpenChange(false);
    if (project) update.mutate({ id: project.id, ...parsed.data }, { onSuccess: done });
    else create.mutate(parsed.data, { onSuccess: (p) => { onCreated?.(p); done(); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>Choose a name, icon and color for the project folder.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} autoFocus maxLength={120} aria-invalid={!!error} aria-describedby={error ? "project-name-error" : undefined} />
            {error && <p id="project-name-error" role="alert" className="text-xs text-destructive">{error}</p>}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Icon</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROJECT_ICONS) as ProjectIconKey[]).map((key) => {
                const Icon = PROJECT_ICONS[key];
                return (
                  <button key={key} type="button" aria-label={key} aria-pressed={icon === key} onClick={() => setIcon(key)} className={cn("grid size-10 place-items-center rounded-xl border-2 transition-colors hover:bg-accent", icon === key ? "border-primary bg-accent" : "border-transparent")}>
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Color</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("size-8 rounded-full border-2 transition-transform hover:scale-110", color === c ? "border-[#3B2A4A] ring-2 ring-primary ring-offset-2" : "border-white/70")} style={{ background: c }} />
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : project ? "Save" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
