"use client";

import { Show } from "@clerk/nextjs";
import { ProjectIcon } from "@/components/project-icon";
import { useProjects } from "@/lib/queries";
import { useActiveProject } from "@/stores/active-project";
import { useWindowStore } from "./window-store";

function Pill() {
  const { data } = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const open = useWindowStore((s) => s.open);
  const project = data?.items.find((p) => p.id === activeId);
  if (!project) return null;
  return (
    <button
      type="button"
      onClick={() => open("projects")}
      aria-label={`Selected project: ${project.name}. Press to open Projects`}
      className="hidden max-w-48 items-center gap-1.5 rounded-full border border-white/40 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/30 sm:flex"
      style={{ background: "var(--pill-bg)" }}
    >
      <ProjectIcon name={project.icon} className="size-3.5 shrink-0" style={{ color: project.color ?? undefined }} />
      <span className="truncate">{project.name}</span>
    </button>
  );
}

/** Hiện dự án đang chọn trên MenuBar (chỉ khi đã đăng nhập). */
export function ActiveProjectPill() {
  return (
    <Show when="signed-in">
      <Pill />
    </Show>
  );
}
