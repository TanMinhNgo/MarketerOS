import { z } from 'zod';
import { CreateContentSchema } from './content';
import { UpsertBrandBriefFieldsSchema } from './core';

const id = z.string().min(1).max(100);
export const AssistantActionStatusSchema = z.enum([
  'proposed',
  'applied',
  'dismissed',
]);
const base = { id, status: AssistantActionStatusSchema };
const draft = CreateContentSchema.omit({ generationId: true })
  .extend({ ...base, type: z.literal('create_draft') })
  .strict();
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
  .extend({ ...base, type: z.literal('edit_content'), contentId: id })
  .strict();
const hasEdit = (value: object) =>
  ['title', 'body', 'hashtags', 'cta'].some((field) => field in value);

export const AssistantActionSchema = z.discriminatedUnion('type', [
  draft,
  schedule,
  brief,
  edit.refine(hasEdit, 'Cần ít nhất một trường nội dung.'),
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type AssistantActionStatus = z.infer<typeof AssistantActionStatusSchema>;
// IDs and status belong to the server, not the model.
export const AssistantProposedActionSchema = z.discriminatedUnion('type', [
  draft.omit({ id: true, status: true }),
  schedule.omit({ id: true, status: true }),
  brief.omit({ id: true, status: true }),
  edit
    .omit({ id: true, status: true })
    .refine(hasEdit, 'Cần ít nhất một trường nội dung.'),
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
