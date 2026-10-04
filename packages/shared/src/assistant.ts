import { z } from 'zod';
import { CreateContentSchema } from './content';
import { UpsertBrandBriefFieldsSchema } from './core';
import { GenerateImageInputSchema } from './media';

const id = z.string().min(1).max(100);
export const AssistantActionStatusSchema = z.enum([
  'proposed',
  'applied',
  'dismissed',
]);
const base = { id, status: AssistantActionStatusSchema };
const mediaIds = z
  .array(id)
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate asset ID.');
const imagePrompt = z.string().trim().min(1).max(2000);
const draft = CreateContentSchema.omit({ generationId: true })
  .extend({
    ...base,
    type: z.literal('create_draft'),
    assetIds: mediaIds.optional(),
    imagePrompt: imagePrompt.optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.assetIds?.length ?? 0) + Number(Boolean(value.imagePrompt)) <= 10,
    'At most 10 images may be attached.',
  );
const schedule = z
  .object({
    ...base,
    type: z.literal('schedule'),
    contentId: id,
    scheduledAt: z.iso.datetime({ offset: true }),
  })
  .strict();
const brief = z
  .object({
    ...base,
    type: z.literal('update_brief'),
    changes: UpsertBrandBriefFieldsSchema.extend({
      businessAddress: UpsertBrandBriefFieldsSchema.shape.businessAddress.in,
    })
      .partial()
      .strict()
      .refine(
        (value) => Object.keys(value).length > 0,
        'Cần ít nhất một thay đổi.',
      ),
  })
  .strict();
const edit = CreateContentSchema.pick({
  title: true,
  body: true,
  hashtags: true,
  cta: true,
})
  .extend({
    hashtags: CreateContentSchema.shape.hashtags.removeDefault(),
    cta: CreateContentSchema.shape.cta.removeDefault(),
  })
  .partial()
  .extend({
    ...base,
    type: z.literal('edit_content'),
    contentId: id,
    assetIds: mediaIds.optional(),
    assetMode: z.enum(['append', 'replace']).optional(),
    imagePrompt: imagePrompt.optional(),
  })
  .strict();
const hasEdit = (value: { assetIds?: string[]; imagePrompt?: string }) =>
  ['title', 'body', 'hashtags', 'cta'].some((field) => field in value) ||
  Boolean(value.assetIds?.length || value.imagePrompt);
const validEditImages = (value: {
  assetIds?: string[];
  assetMode?: 'append' | 'replace';
  imagePrompt?: string;
}) =>
  value.assetMode !== 'replace' ||
  (value.assetIds?.length ?? 0) + Number(Boolean(value.imagePrompt)) <= 10;
const generateImage = GenerateImageInputSchema.extend({
  ...base,
  type: z.literal('generate_image'),
  attachToContentId: id.optional(),
}).strict();
const attachMedia = z
  .object({
    ...base,
    type: z.literal('attach_media'),
    contentId: id,
    assetIds: z
      .array(id)
      .min(1)
      .max(10)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate asset ID.'),
    mode: z.enum(['append', 'replace']),
  })
  .strict();

export const AssistantActionSchema = z.discriminatedUnion('type', [
  draft,
  schedule,
  brief,
  edit
    .refine(hasEdit, 'Cần ít nhất một trường nội dung hoặc ảnh.')
    .refine(validEditImages, 'At most 10 images may be attached.'),
  generateImage,
  attachMedia,
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type AssistantActionStatus = z.infer<typeof AssistantActionStatusSchema>;
// IDs and status belong to the server, not the model.
export const AssistantProposedActionSchema = z.discriminatedUnion('type', [
  CreateContentSchema.omit({ generationId: true })
    .extend({
      type: z.literal('create_draft'),
      assetIds: mediaIds.optional(),
      imagePrompt: imagePrompt.optional(),
    })
    .strict()
    .refine(
      (value) =>
        (value.assetIds?.length ?? 0) + Number(Boolean(value.imagePrompt)) <=
        10,
      'At most 10 images may be attached.',
    ),
  schedule.omit({ id: true, status: true }),
  brief.omit({ id: true, status: true }),
  edit
    .omit({ id: true, status: true })
    .refine(hasEdit, 'Cần ít nhất một trường nội dung hoặc ảnh.')
    .refine(validEditImages, 'At most 10 images may be attached.'),
  generateImage.omit({ id: true, status: true }),
  attachMedia.omit({ id: true, status: true }),
]);
export const AssistantOutputSchema = z
  .object({
    text: z.string().trim().min(1).max(12000),
    actions: z.array(AssistantProposedActionSchema).max(5),
  })
  .strict();
export type AssistantProposedAction = z.infer<
  typeof AssistantProposedActionSchema
>;
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;
export const AssistantMessageSchema = z
  .object({
    id,
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(12000),
    createdAt: z.iso.datetime(),
    actions: z.array(AssistantActionSchema).max(5),
    automationId: id.nullable().optional(),
  })
  .strict();
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export const AssistantMessageInputSchema = z
  .object({ content: z.string().trim().min(1).max(4000) })
  .strict();
export type AssistantMessageInput = z.infer<typeof AssistantMessageInputSchema>;
export const AssistantMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: id.optional(),
  })
  .strict();
export type AssistantMessagesQuery = z.infer<
  typeof AssistantMessagesQuerySchema
>;
export const AssistantMessagesResponseSchema = z
  .object({ items: z.array(AssistantMessageSchema), hasMore: z.boolean() })
  .strict();
export const AssistantMessageDeltaSchema = z
  .object({ text: z.string() })
  .strict();
export type AssistantMessagesResponse = z.infer<
  typeof AssistantMessagesResponseSchema
>;
export type AssistantMessageDelta = z.infer<typeof AssistantMessageDeltaSchema>;
export const AssistantDoneSchema = z
  .object({
    userMessage: AssistantMessageSchema,
    assistantMessage: AssistantMessageSchema,
  })
  .strict();
export type AssistantDone = z.infer<typeof AssistantDoneSchema>;
export const UpdateAssistantActionSchema = z
  .object({ status: z.enum(['applied', 'dismissed']) })
  .strict();
export type UpdateAssistantActionInput = z.infer<
  typeof UpdateAssistantActionSchema
>;
