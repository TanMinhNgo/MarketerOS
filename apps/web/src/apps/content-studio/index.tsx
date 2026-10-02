"use client";

import { FileText, FolderOpen } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useBrief, useProjects } from "@/lib/queries";
import { useActiveProject } from "@/stores/active-project";
import { Studio } from "./studio";

function Message({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

/** Cần có Brand Brief thì AI mới viết đúng giọng thương hiệu. */
function StudioWithBrief({ projectId, name }: { projectId: string; name: string }) {
  const open = useWindowStore((s) => s.open);
  const { data, isPending, error, refetch } = useBrief(projectId);

  if (isPending) return <Message><span role="status" className="text-muted-foreground">Loading…</span></Message>;
  if (error)
    return (
      <Message>
        <div>
          <p>{errorMessage(error)}</p>
          <Button className="mt-3" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      </Message>
    );
  if (!data)
    return (
      <Message>
        <div>
          <p className="font-semibold">&ldquo;{name}&rdquo; needs a Brand Brief first</p>
          <p className="mt-1 text-muted-foreground">The AI writes in your brand&apos;s voice, so it needs to know your product, audience and tone.</p>
          <Button className="mt-3" onClick={() => open("brand-brief")}>
            <FileText /> Open Brand Brief
          </Button>
        </div>
      </Message>
    );
  return <Studio projectId={projectId} projectName={name} />;
}

function StudioApp() {
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
          <p className="mt-1 text-muted-foreground">Choose a project to write content for.</p>
          <Button className="mt-3" onClick={() => open("projects")}>
            <FolderOpen /> Open Projects
          </Button>
        </div>
      </Message>
    );
  return <StudioWithBrief key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <StudioApp />
    </AuthGate>
  );
}
