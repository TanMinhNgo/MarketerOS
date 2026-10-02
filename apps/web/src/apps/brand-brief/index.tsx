"use client";

import { FolderOpen } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useBrief, useProjects } from "@/lib/queries";
import { useActiveProject } from "@/stores/active-project";
import { BriefForm } from "./brief-form";

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

function BriefLoader({ projectId, name }: { projectId: string; name: string }) {
  const { data, isPending, error, refetch } = useBrief(projectId);
  if (isPending) return <Message><span role="status" className="text-muted-foreground">Loading brief…</span></Message>;
  if (error)
    return (
      <Message>
        <div>
          <p>{errorMessage(error)}</p>
          <Button className="mt-3" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      </Message>
    );
  return (
    <>
      <div className="border-b px-4 py-2.5">
        <h2 className="font-display text-sm font-bold">Brand Brief · {name}</h2>
      </div>
      {/* khởi tạo form một lần từ dữ liệu đã tải; đổi dự án thì key đổi và form dựng lại */}
      <BriefForm projectId={projectId} brief={data} />
    </>
  );
}

function BriefApp() {
  const { data, isPending } = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const open = useWindowStore((s) => s.open);
  const project = data?.items.find((p) => p.id === activeId);

  if (isPending) return <Message><span role="status" className="text-muted-foreground">Loading…</span></Message>;
  if (!project)
    return (
      <Message>
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Select a project to fill in its Brand Brief.</p>
          <Button className="mt-3" onClick={() => open("projects")}>
            <FolderOpen /> Open Projects
          </Button>
        </div>
      </Message>
    );
  return <BriefLoader key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <BriefApp />
    </AuthGate>
  );
}
