"use client";

import { GenerateContentInputSchema, type ContentLanguage, type GeneratedVariant } from "@marketos/shared";
import { Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { selectFocusedId, useWindowStore } from "@/desktop/window-store";
import { errorMessage } from "@/lib/api-client";
import { LANGUAGES } from "@/lib/languages";
import { useQueryClient } from "@tanstack/react-query";
import { keys, useSaveContent, useUsage } from "@/lib/queries";
import { CHANNELS, type ChannelValue } from "./channels";
import { DraftsPanel } from "./drafts-panel";
import { isQuotaError, useGeneration } from "./use-generation";
import { VariantCard } from "./variant-card";

function GenerationError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const open = useWindowStore((s) => s.open);
  const quota = isQuotaError(error);
  const usage = useUsage(quota).data;
  const resets = usage ? ` They reset on ${new Date(usage.period.end).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` : "";
  return (
    <div role="alert" className="rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-semibold">{quota ? "You've reached your generation limit" : "We couldn't generate content"}</p>
      <p className="mt-1">{quota ? `You've used all ${usage ? usage.usage.text.limit : "your"} AI generations for this month.${resets} Upgrade to Pro for more.` : errorMessage(error)}</p>
      <div className="mt-3 flex gap-2">
        {quota ? <Button size="sm" onClick={() => open("pricing")}>See plans</Button> : <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

export function Studio({ projectId, projectName, language }: { projectId: string; projectName: string; language: ContentLanguage }) {
  const openApp = useWindowStore((s) => s.open);
  const [channel, setChannel] = useState<ChannelValue>("FACEBOOK");
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { state, generate, regenerate, stop, isStreaming } = useGeneration(projectId);
  const save = useSaveContent(projectId);
  const watching = useWindowStore((s) => selectFocusedId(s) === "content-studio");
  const notified = useRef(0);
  const qc = useQueryClient();
  const refreshUsage = () => void qc.invalidateQueries({ queryKey: keys.usage });

  // Báo khi tạo xong hoặc lỗi lúc người dùng không nhìn cửa sổ này (thu nhỏ, cửa sổ khác ở trên, tab ẩn).
  useEffect(() => {
    if ((state.status !== "done" && state.status !== "error") || notified.current === state.run) return;
    notified.current = state.run;
    void qc.invalidateQueries({ queryKey: keys.usage });
    const away = !watching || document.hidden;
    const action = { label: "Open Content Studio", appId: "content-studio" };
    if (state.status === "done") {
      notify.success("Your 3 variants are ready", { description: `For ${projectName}. Review and save the ones you like.`, action, persist: true, os: true, silent: !away });
    } else if (isQuotaError(state.error)) {
      notify.warning("Generation limit reached", { description: "Upgrade or try again later.", action: { label: "See plans", appId: "pricing" }, persist: true, silent: !away });
    } else {
      notify.error("Content generation failed", { description: errorMessage(state.error), action, persist: true, os: true, silent: !away });
    }
  }, [state.status, state.run, state.error, watching, projectName, qc]);

  const run = () => {
    const parsed = GenerateContentInputSchema.safeParse({ channel, goal, topic, ...(notes.trim() ? { notes } : {}) });
    if (!parsed.success) return setFormError("Add a goal and a topic first.");
    setFormError(null);
    void generate(parsed.data);
  };

  const regenerateVariant = (index: number) =>
    regenerate(index)
      .finally(refreshUsage)
      .catch((e: unknown) =>
      isQuotaError(e)
        ? notify.warning("Generation limit reached", { description: "The previous version was kept. Upgrade or try again later.", action: { label: "See plans", appId: "pricing" } })
        : notify.error("Couldn't regenerate this variant", { description: `The previous version was kept. ${errorMessage(e)}` }),
    );

  // Kênh lấy từ lần tạo (form có thể đã đổi sau đó), generationId theo từng biến thể.
  const saveVariant = async (v: GeneratedVariant, generationId: string | null) => {
    await save
      .mutateAsync({ channel: state.input?.channel ?? channel, title: v.title, body: v.body, hashtags: v.hashtags, cta: v.cta ? v.cta : null, generationId })
      .then(() => notify.success("Saved to drafts", { description: "Find it in Saved drafts and on the Content Calendar." }))
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
            <p className="text-sm text-muted-foreground">
              Writing for <strong>{projectName}</strong> in <strong>{LANGUAGES[language].label}</strong>, in the voice of its Brand Brief.{" "}
              <button type="button" onClick={() => openApp("brand-brief")} className="font-medium text-primary underline-offset-2 hover:underline">
                Change
              </button>
            </p>
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
                <VariantCard
                  key={`${i}-${v.rev}`}
                  index={i}
                  state={v}
                  saving={save.isPending}
                  onSave={(data) => saveVariant(data, v.generationId)}
                  onRegenerate={isStreaming ? undefined : () => void regenerateVariant(i)}
                />
              ))}
            </div>
          )}
        </div>

        <DraftsPanel projectId={projectId} />
      </div>
    </div>
  );
}
