"use client";

import { FolderOpen } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { useProjects } from "@/lib/queries";
import { useActiveProject } from "@/stores/active-project";
import { Calendar } from "./calendar";

function CalendarApp() {
  const { data, isPending } = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const open = useWindowStore((s) => s.open);
  const project = data?.items.find((p) => p.id === activeId);

  if (isPending) return <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground" role="status">Loading…</div>;
  if (!project)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm">
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Choose a project to plan its content.</p>
          <Button className="mt-3" onClick={() => open("projects")}>
            <FolderOpen /> Open Projects
          </Button>
        </div>
      </div>
    );
  return <Calendar key={project.id} projectId={project.id} />;
}

export default function App() {
  return (
    <AuthGate>
      <CalendarApp />
    </AuthGate>
  );
}
