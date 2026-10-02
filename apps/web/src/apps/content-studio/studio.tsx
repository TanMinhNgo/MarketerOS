"use client";

import { GenerateContentInputSchema, type GeneratedVariant } from "@marketos/shared";
import { Sparkles, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { useSaveContent } from "@/lib/queries";
import { CHANNELS, type ChannelValue } from "./channels";
import { DraftsPanel } from "./drafts-panel";
import { isQuotaError, useGeneration } from "./use-generation";
import { VariantCard } from "./variant-card";

function GenerationError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const open = useWindowStore((s) => s.open);
  const quota = isQuotaError(error);
  return (
    <div role="alert" className="rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-semibold">{quota ? "You've reached your generation limit" : "We couldn't generate content"}</p>
      <p className="mt-1">{quota ? "Your plan's AI generations are used up for now. Upgrade for more, or try again later." : errorMessage(error)}</p>
      <div className="mt-3 flex gap-2">
        {quota ? <Button size="sm" onClick={() => open("pricing")}>See plans</Button> : <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

export function Studio({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [channel, setChannel] = useState<ChannelValue>("FACEBOOK");
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { state, generate, stop, isStreaming } = useGeneration(projectId);
  const save = useSaveContent(projectId);

  const run = () => {
    const parsed = GenerateContentInputSchema.safeParse({ channel, goal, topic, ...(notes.trim() ? { notes } : {}) });
    if (!parsed.success) return setFormError("Add a goal and a topic first.");
    setFormError(null);
    void generate(parsed.data);
  };

  const saveVariant = async (v: GeneratedVariant) => {
    await save
      .mutateAsync({ channel, title: v.title, body: v.body, hashtags: v.hashtags, cta: v.cta ? v.cta : null, generationId: state.generationId })
      .then(() => toast.success("Saved to drafts"))
      .catch(() => {
        // lỗi đã hiện bằng toast từ MutationCache; ném lại để thẻ không báo "đã lưu"
        throw new Error("save failed");
      });
  };

  return (
    <div className="@container h-full overflow-y-auto">
      <div className="grid gap-6 p-5 @3xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <header>
            <h2 className="font-display text-xl font-bold">Content Studio</h2>
            <p className="text-sm text-muted-foreground">Writing for <strong>{projectName}</strong>, in the voice of its Brand Brief.</p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isStreaming) run();
            }}
            className="space-y-3 rounded-2xl border-2 border-[#3B2A4A]/40 bg-card p-4"
          >
            <div className="grid gap-3 @lg:grid-cols-[180px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="cs-channel">Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as ChannelValue)} disabled={isStreaming}>
                  <SelectTrigger id="cs-channel" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-goal">Goal</Label>
                <Input id="cs-goal" value={goal} maxLength={1000} disabled={isStreaming} placeholder="e.g. Get sign-ups for the launch webinar" onChange={(e) => setGoal(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-topic">Topic</Label>
              <Textarea id="cs-topic" value={topic} rows={2} maxLength={1000} disabled={isStreaming} placeholder="What should the post be about?" onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="cs-notes" value={notes} rows={2} maxLength={3000} disabled={isStreaming} placeholder="Offers, dates, links, anything the AI should keep in mind" onChange={(e) => setNotes(e.target.value)} />
            </div>
            {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <Button type="button" variant="outline" onClick={stop}><Square /> Stop</Button>
              ) : (
                <Button type="submit"><Sparkles /> {state.status === "idle" ? "Generate 3 variants" : "Generate again"}</Button>
              )}
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {isStreaming && "Writing your variants…"}
                {state.status === "stopped" && "Stopped. What arrived is kept below."}
                {state.status === "done" && "Done. Edit any variant, then save it."}
              </span>
            </div>
          </form>

          {state.status === "error" && <GenerationError error={state.error} onRetry={run} />}

          {state.variants.length > 0 && (
            <div className="space-y-4" key={state.run}>
              {state.variants.map((v, i) => (
                <VariantCard key={i} index={i} state={v} saving={save.isPending} onSave={saveVariant} />
              ))}
            </div>
          )}
        </div>

        <DraftsPanel projectId={projectId} />
      </div>
    </div>
  );
}
