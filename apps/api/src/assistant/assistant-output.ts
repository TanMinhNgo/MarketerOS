import { z } from 'zod';
import {
  AssistantOutputSchema,
  type AssistantProposedAction,
  CreateContentSchema,
  GenerateImageInputSchema,
  UpsertBrandBriefFieldsSchema,
} from '@marketos/shared';

const content = CreateContentSchema.shape;
const brief = UpsertBrandBriefFieldsSchema.shape;
const patch = <K extends string, S extends z.ZodType>(field: K, value: S) =>
  z.object({ field: z.literal(field), value }).strict();
const editChanges = z.union([
  patch('title', content.title),
  patch('body', content.body),
  patch('hashtags', content.hashtags.removeDefault()),
  patch('cta', content.cta.removeDefault()),
]);
const briefChanges = z.union([
  patch('product', brief.product),
  patch('audience', brief.audience),
  patch('tone', brief.tone),
  patch('language', brief.language),
  patch('businessAddress', brief.businessAddress.in),
  patch('keyMessages', brief.keyMessages),
  patch('avoidWords', brief.avoidWords),
  patch('samplePosts', brief.samplePosts),
  patch('brandColors', brief.brandColors),
  patch('visualStyle', brief.visualStyle),
]);
// OpenAI strict output requires every property; patch arrays preserve absent vs null.
export const AssistantProviderOutputSchema = z
  .object({
    text: AssistantOutputSchema.shape.text,
    validationNote: z.string().trim().min(1).max(500),
    actions: z
      .array(
        z.union([
          z
            .object({
              type: z.literal('create_draft'),
              channel: content.channel,
              title: content.title,
              body: content.body,
              hashtags: content.hashtags.removeDefault(),
              cta: content.cta.removeDefault(),
              assetIds: z.array(z.string().min(1).max(100)).max(20).nullable(),
              imagePrompt: GenerateImageInputSchema.shape.prompt.nullable(),
            })
            .strict(),
          z
            .object({
              type: z.literal('schedule'),
              contentId: z.string().min(1).max(100),
              scheduledAt: z.iso.datetime({ offset: true }),
            })
            .strict(),
          z
            .object({
              type: z.literal('update_brief'),
              changes: z.array(briefChanges).min(1).max(10),
            })
            .strict(),
          z
            .object({
              type: z.literal('edit_content'),
              contentId: z.string().min(1).max(100),
              changes: z.array(editChanges).max(4),
              assetIds: z.array(z.string().min(1).max(100)).max(20).nullable(),
              assetMode: z.enum(['append', 'replace']).nullable(),
              imagePrompt: GenerateImageInputSchema.shape.prompt.nullable(),
            })
            .strict(),
          z
            .object({
              type: z.literal('generate_image'),
              prompt: GenerateImageInputSchema.shape.prompt,
              name: GenerateImageInputSchema.shape.name.unwrap().nullable(),
              size: GenerateImageInputSchema.shape.size.removeDefault(),
              attachToContentId: z.string().min(1).max(100).nullable(),
            })
            .strict(),
          z
            .object({
              type: z.literal('attach_media'),
              contentId: z.string().min(1).max(100),
              assetIds: z.array(z.string().min(1).max(100)).min(1).max(20),
              mode: z.enum(['append', 'replace']),
            })
            .strict(),
        ]),
      )
      .max(5),
  })
  .strict();

type ProviderAction = z.infer<
  typeof AssistantProviderOutputSchema
>['actions'][number];

function normalizeDraft(
  action: Extract<ProviderAction, { type: 'create_draft' }>,
) {
  return {
    type: action.type,
    channel: action.channel,
    title: action.title,
    body: action.body,
    hashtags: action.hashtags,
    cta: action.cta,
    ...(action.assetIds ? { assetIds: action.assetIds } : {}),
    ...(action.imagePrompt ? { imagePrompt: action.imagePrompt } : {}),
  };
}

function normalizeImage(
  action: Extract<ProviderAction, { type: 'generate_image' }>,
) {
  return {
    type: action.type,
    prompt: action.prompt,
    size: action.size,
    ...(action.name ? { name: action.name } : {}),
    ...(action.attachToContentId
      ? { attachToContentId: action.attachToContentId }
      : {}),
  };
}

function normalizePatch(
  action: Extract<ProviderAction, { type: 'edit_content' | 'update_brief' }>,
) {
  if (
    new Set(action.changes.map((change) => change.field)).size !==
    action.changes.length
  )
    throw new Error('Duplicate assistant patch field');
  const changes = Object.fromEntries(
    action.changes.map(({ field, value }) => [field, value]),
  );
  if (action.type === 'update_brief') return { type: action.type, changes };
  return {
    type: action.type,
    contentId: action.contentId,
    ...changes,
    ...(action.assetIds ? { assetIds: action.assetIds } : {}),
    ...(action.assetMode ? { assetMode: action.assetMode } : {}),
    ...(action.imagePrompt ? { imagePrompt: action.imagePrompt } : {}),
  };
}

function normalizeAction(action: ProviderAction) {
  if (action.type === 'create_draft') return normalizeDraft(action);
  if (action.type === 'generate_image') return normalizeImage(action);
  if (action.type === 'edit_content' || action.type === 'update_brief')
    return normalizePatch(action);
  return action;
}

export function parseAssistantOutput(raw: unknown) {
  const output = AssistantProviderOutputSchema.parse(raw);
  return {
    text: AssistantOutputSchema.shape.text.parse(output.text),
    // Each proposed action is validated separately so one invalid media action
    // cannot discard an otherwise useful assistant reply.
    actions: output.actions.map(normalizeAction) as AssistantProposedAction[],
    validationNote: output.validationNote,
  };
}
