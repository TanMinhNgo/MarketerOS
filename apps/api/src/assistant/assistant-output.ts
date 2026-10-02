import { z } from 'zod';
import {
  AssistantOutputSchema,
  CreateContentSchema,
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
              changes: z.array(editChanges).min(1).max(4),
            })
            .strict(),
        ]),
      )
      .max(5),
  })
  .strict();

export function parseAssistantOutput(raw: unknown) {
  const output = AssistantProviderOutputSchema.parse(raw);
  return {
    ...AssistantOutputSchema.parse({
      text: output.text,
      actions: output.actions.map((action) => {
        if (!('changes' in action)) return action;
        if (
          new Set(action.changes.map((change) => change.field)).size !==
          action.changes.length
        )
          throw new Error('Duplicate assistant patch field');
        const changes = Object.fromEntries(
          action.changes.map(({ field, value }) => [field, value]),
        );
        return action.type === 'update_brief'
          ? { type: action.type, changes }
          : { type: action.type, contentId: action.contentId, ...changes };
      }),
    }),
    validationNote: output.validationNote,
  };
}
