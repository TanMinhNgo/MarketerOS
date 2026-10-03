"use client";

import { PLAN_LIMITS } from "@marketos/shared";
import { FileText, FolderOpen, Lock, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useBrief, useProjects, useUsage } from "@/lib/queries";
import { useActiveProject } from "@/stores/active-project";
import { Chat } from "./chat";

function Message({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid h-full place-items-center p-6 text-center text-sm">{children}</div>;
}

const Loading = () => <Message><output className="text-muted-foreground">Loading…</output></Message>;

/** Assistant dùng Brand Brief làm ngữ cảnh: chưa có brief thì backend cũng từ chối. */
function WithBrief({ projectId, name }: Readonly<{ projectId: string; name: string }>) {
  const open = useWindowStore((s) => s.open);
  const { data, isPending, error, refetch } = useBrief(projectId);
  if (isPending) return <Loading />;
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
          <p className="mt-1 text-muted-foreground">The assistant answers from your brief, so it needs your product, audience and tone.</p>
          <Button className="mt-3" onClick={() => open("brand-brief")}><FileText /> Open Brand Brief</Button>
        </div>
      </Message>
    );
  return <Chat projectId={projectId} projectName={name} brief={data} />;
}

function AssistantApp() {
  const open = useWindowStore((s) => s.open);
  const usage = useUsage();
  const projects = useProjects();
  const activeId = useActiveProject((s) => s.activeId);
  const project = projects.data?.items.find((p) => p.id === activeId);

  if (usage.isPending || projects.isPending) return <Loading />;
  if (usage.error) return <Message><p>{errorMessage(usage.error)}</p></Message>;
  // Quyền do backend xác minh từ token Clerk (u:ai_assistant); API cũng trả 403 PLAN_REQUIRED nếu thiếu.
  if (!usage.data.features.includes("ai_assistant"))
    return (
      <Message>
        <div className="max-w-sm">
          <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">AI Assistant is part of Pro</p>
          <p className="mt-1 text-muted-foreground">Chat about a project with an assistant that knows its Brand Brief and posts. It suggests drafts, edits, schedules and brief changes you can apply in one click. Pro includes {PLAN_LIMITS.pro.assistant} messages a month.</p>
          <Button className="mt-3" onClick={() => open("plans-billing")}><Sparkles /> Upgrade to Pro</Button>
        </div>
      </Message>
    );
  if (!project)
    return (
      <Message>
        <div>
          <p className="font-semibold">No project selected</p>
          <p className="mt-1 text-muted-foreground">Choose a project to chat about.</p>
          <Button className="mt-3" onClick={() => open("projects")}><FolderOpen /> Open Projects</Button>
        </div>
      </Message>
    );
  return <WithBrief key={project.id} projectId={project.id} name={project.name} />;
}

export default function App() {
  return (
    <AuthGate>
      <AssistantApp />
    </AuthGate>
  );
}
