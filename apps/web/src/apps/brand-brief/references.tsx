"use client";

import { ReferenceInputSchema, ReferencesResponseSchema, type Reference, type ReferenceInput } from "@marketos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, request } from "@/lib/api-client";
import { useUsage } from "@/lib/queries";

const MAX_REFERENCES = 10;
const MAX_TEXT = 4000;
const PURPOSE: Record<ReferenceInput["purpose"], string> = { KNOWLEDGE: "Facts to use", WRITING_STYLE: "Writing style to learn" };
const EMPTY: ReferenceInput = { title: "", contentText: "", purpose: "KNOWLEDGE", enabled: true };

const toInput = ({ title, contentText, purpose, enabled }: Reference): ReferenceInput => ({ title, contentText, purpose, enabled });

/** CRUD reference chữ của dự án. Backend trả 204 cho ghi nên luôn tải lại danh sách sau đó. PUT thay toàn bộ trường. */
function useReferences(projectId: string, enabled: boolean) {
  const qc = useQueryClient();
  const key = ["references", projectId] as const;
  const path = `/api/projects/${projectId}/references`;
  const list = useQuery({ queryKey: key, queryFn: () => api(path, ReferencesResponseSchema), enabled });
  const write = useMutation({
    meta: { silent: true },
    mutationFn: ({ id, body, remove }: { id?: string; body?: ReferenceInput; remove?: boolean }) =>
      request(id ? `${path}/${id}` : path, { method: remove ? "DELETE" : id ? "PUT" : "POST", body }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { list, write };
}

function ReferenceEditor({ initial, saving, onSave, onCancel }: Readonly<{ initial: ReferenceInput; saving: boolean; onSave: (r: ReferenceInput) => void; onCancel: () => void }>) {
  const [value, setValue] = useState(initial);
  const parsed = ReferenceInputSchema.safeParse(value);
  const set = (patch: Partial<ReferenceInput>) => setValue((v) => ({ ...v, ...patch }));
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="space-y-1">
        <Label htmlFor="ref-title">Title</Label>
        <Input id="ref-title" maxLength={200} value={value.title} placeholder="e.g. Menu and prices" onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ref-text">Text</Label>
        <Textarea id="ref-text" rows={5} maxLength={MAX_TEXT} value={value.contentText} placeholder="Paste facts, an FAQ, or writing you want the AI to sound like…" onChange={(e) => set({ contentText: e.target.value })} />
        <p className="text-right text-[11px] text-muted-foreground">{value.contentText.length} / {MAX_TEXT}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={value.purpose} onValueChange={(v) => set({ purpose: v as ReferenceInput["purpose"] })}>
          <SelectTrigger aria-label="Use it for" className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PURPOSE).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Use in AI
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!parsed.success || saving} onClick={() => parsed.success && onSave(parsed.data)}>{saving ? "Saving…" : "Save reference"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** References chữ cho AI: thêm / sửa / bật tắt / xoá. Bản đang bật được dùng ở lượt AI tiếp theo (Content Studio, Assistant, automation). */
export function References({ projectId }: Readonly<{ projectId: string }>) {
  const allowed = useUsage().data?.features.includes("personalization") ?? false;
  const { list, write } = useReferences(projectId, allowed);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (!allowed) return null;
  const items = list.data?.items ?? [];
  const full = items.length >= MAX_REFERENCES;
  const save = (body: ReferenceInput, id?: string) => write.mutate({ id, body }, { onSuccess: () => setEditing(null) });

  return (
    <section aria-labelledby="refs-title" className="space-y-3 border-t p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-primary" aria-hidden="true" />
        <h3 id="refs-title" className="flex-1 font-display text-sm font-bold">References <span className="font-normal text-muted-foreground">({items.length} / {MAX_REFERENCES})</span></h3>
        {editing !== "new" && (
          <Button type="button" size="xs" variant="outline" disabled={full || !list.data} title={full ? `Up to ${MAX_REFERENCES} references per project` : undefined} onClick={() => setEditing("new")}>
            <Plus /> Add reference
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Text the AI reads for this project. References turned on are used from the next generation, assistant message or automation run. The Brand Brief still comes first.</p>
      {list.error && <p role="alert" className="text-xs text-destructive">{errorMessage(list.error)}</p>}
      {write.error && <p role="alert" className="text-xs text-destructive">{errorMessage(write.error)}</p>}
      {editing === "new" && <ReferenceEditor initial={EMPTY} saving={write.isPending} onSave={(r) => save(r)} onCancel={() => setEditing(null)} />}
      <ul className="space-y-2">
        {items.map((r) =>
          editing === r.id ? (
            <li key={r.id}><ReferenceEditor initial={toInput(r)} saving={write.isPending} onSave={(body) => save(body, r.id)} onCancel={() => setEditing(null)} /></li>
          ) : (
            <li key={r.id} className="rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{PURPOSE[r.purpose]}</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" className="accent-primary" checked={r.enabled} disabled={write.isPending} onChange={(e) => write.mutate({ id: r.id, body: { ...toInput(r), enabled: e.target.checked } })} /> On
                </label>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{r.contentText}</p>
              <div className="mt-2 flex gap-1">
                <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(r.id)}><Pencil /> Edit</Button>
                {confirmId === r.id ? (
                  <>
                    <Button type="button" size="xs" variant="destructive" disabled={write.isPending} onClick={() => write.mutate({ id: r.id, remove: true }, { onSuccess: () => setConfirmId(null) })}>Delete</Button>
                    <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmId(r.id)}><Trash2 /> Delete</Button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {list.data && !items.length && editing !== "new" && <p className="text-xs text-muted-foreground">No references yet. Add your menu, an FAQ or a few posts in your voice.</p>}
    </section>
  );
}
