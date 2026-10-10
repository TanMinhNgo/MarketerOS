import { z } from 'zod';

export const ReferenceInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    contentText: z.string().trim().min(1).max(4000),
    purpose: z.enum(['KNOWLEDGE', 'WRITING_STYLE']).default('KNOWLEDGE'),
    enabled: z.boolean().default(true),
  })
  .strict();
export const ReferenceSchema = ReferenceInputSchema.extend({
  id: z.string(),
  projectId: z.string(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export const ReferencesResponseSchema = z
  .object({ items: z.array(ReferenceSchema).max(10) })
  .strict();
export type ReferenceInput = z.infer<typeof ReferenceInputSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
