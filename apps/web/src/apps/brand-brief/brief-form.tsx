"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UpsertBrandBriefSchema, type BrandBriefResponse } from "@marketos/shared";
import { Controller, useForm, type FieldError } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ColorList } from "@/components/color-list";
import { StringList } from "@/components/string-list";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveBrief } from "@/lib/queries";

type In = z.input<typeof UpsertBrandBriefSchema>;
type Out = z.output<typeof UpsertBrandBriefSchema>;

const toForm = (b: BrandBriefResponse | null): In => ({
  product: b?.product ?? "",
  audience: b?.audience ?? "",
  tone: b?.tone ?? "",
  keyMessages: b?.keyMessages ?? [],
  avoidWords: b?.avoidWords ?? [],
  samplePosts: b?.samplePosts ?? [],
  brandColors: b?.brandColors ?? [],
  visualStyle: b?.visualStyle ?? null,
});

const msg = (e?: FieldError) => (!e ? null : e.type === "too_big" ? "Too long." : e.type === "too_small" ? "This field is required." : "Invalid value.");

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: string; error?: FieldError; children: React.ReactNode }) {
  const m = msg(error);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !m && <p className="text-xs text-muted-foreground">{hint}</p>}
      {m && <p role="alert" className="text-xs text-destructive">{m}</p>}
    </div>
  );
}

export function BriefForm({ projectId, brief }: { projectId: string; brief: BrandBriefResponse | null }) {
  const save = useSaveBrief(projectId);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(UpsertBrandBriefSchema), defaultValues: toForm(brief) });
  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = form;

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        reset(toForm(saved));
        toast.success("Brand Brief saved");
      },
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4" noValidate>
      <Field label="Product / service" htmlFor="bb-product" error={errors.product}>
        <Textarea id="bb-product" rows={3} aria-invalid={!!errors.product} {...register("product")} />
      </Field>
      <Field label="Target audience" htmlFor="bb-audience" error={errors.audience}>
        <Textarea id="bb-audience" rows={2} aria-invalid={!!errors.audience} {...register("audience")} />
      </Field>
      <Field label="Tone of voice" htmlFor="bb-tone" hint="Example: friendly, approachable, a little humorous" error={errors.tone}>
        <Input id="bb-tone" aria-invalid={!!errors.tone} {...register("tone")} />
      </Field>
      <Field label="Key messages" htmlFor="bb-key" hint="Type, then press Enter to add" error={errors.keyMessages as FieldError | undefined}>
        <Controller control={control} name="keyMessages" render={({ field }) => <TagInput id="bb-key" value={field.value ?? []} onChange={field.onChange} placeholder="Add a message…" />} />
      </Field>
      <Field label="Words to avoid" htmlFor="bb-avoid" hint="The AI will not use these words" error={errors.avoidWords as FieldError | undefined}>
        <Controller control={control} name="avoidWords" render={({ field }) => <TagInput id="bb-avoid" value={field.value ?? []} onChange={field.onChange} placeholder="Add a word to avoid…" max={100} />} />
      </Field>
      <Field label="Sample posts" error={errors.samplePosts as FieldError | undefined}>
        <Controller control={control} name="samplePosts" render={({ field }) => <StringList value={field.value ?? []} onChange={field.onChange} addLabel="Add sample post" placeholder="Paste a post you like…" />} />
      </Field>
      <Field label="Brand colors" error={errors.brandColors as FieldError | undefined}>
        <Controller control={control} name="brandColors" render={({ field }) => <ColorList value={field.value ?? []} onChange={field.onChange} />} />
      </Field>
      <Field label="Visual style" htmlFor="bb-visual" error={errors.visualStyle}>
        <Controller
          control={control}
          name="visualStyle"
          render={({ field }) => <Textarea id="bb-visual" rows={2} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value.trim() ? e.target.value : null)} />}
        />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="submit" disabled={!isDirty || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">{isDirty ? "Unsaved changes" : brief ? "Saved" : "No brief yet"}</span>
      </div>
    </form>
  );
}
