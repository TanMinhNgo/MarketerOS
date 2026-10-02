"use client";

import { RotateCcw } from "lucide-react";
import { notify } from "@/lib/notify/notify";
import { AuthGate } from "@/components/auth-gate";
import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";
import { useRestoreProject, useTrash } from "@/lib/queries";

const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function TrashApp() {
  const { data, isPending, error, refetch } = useTrash();
  const restore = useRestoreProject();

  if (isPending) return <div className="p-6 text-sm text-muted-foreground" role="status">Loading Trash…</div>;
  if (error)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm">
        <div>
          <p>{errorMessage(error)}</p>
          <Button className="mt-3" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  if (data.items.length === 0)
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">Trash is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Deleted projects appear here so you can restore them.</p>
        </div>
      </div>
    );

  return (
    <ul className="divide-y">
      {data.items.map((p) => {
        return (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-[#3B2A4A] text-white opacity-70" style={{ background: p.color ?? "#6D5BFF" }}>
              <ProjectIcon name={p.icon} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              {p.deletedAt && <p className="text-xs text-muted-foreground">Deleted {when.format(new Date(p.deletedAt))}</p>}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={restore.isPending && restore.variables === p.id}
              onClick={() => restore.mutate(p.id, { onSuccess: () => notify.success(`Restored "${p.name}"`, { description: "It's back in Projects.", action: { label: "Open Projects", appId: "projects" }, persist: true }) })}
            >
              <RotateCcw /> Restore
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  return (
    <AuthGate>
      <TrashApp />
    </AuthGate>
  );
}
