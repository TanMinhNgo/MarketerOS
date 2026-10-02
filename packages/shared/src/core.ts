import { z } from 'zod';
import { PlanKeySchema } from './plans';

const text = (max: number) => z.string().trim().min(1).max(max);
export const ProjectFieldsSchema = z.object({
  name: text(120),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  icon: z
    .enum(['folder', 'megaphone', 'rocket', 'store', 'briefcase', 'sparkles'])
    .nullable()
    .optional(),
});
export const CreateProjectSchema = ProjectFieldsSchema.strict();
export const UpdateProjectSchema = ProjectFieldsSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Cần ít nhất một trường cập nhật.',
  });
export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const ProjectListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const ProjectListResponseSchema = z.object({
  items: z.array(ProjectResponseSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});
export const UpsertBrandBriefSchema = z
  .object({
    product: text(5000),
    audience: text(3000),
    tone: text(500),
    keyMessages: z.array(text(500)).max(20).default([]),
    avoidWords: z.array(text(100)).max(100).default([]),
    samplePosts: z.array(text(5000)).max(10).default([]),
    brandColors: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .max(10)
      .default([]),
    visualStyle: text(2000).nullable().default(null),
  })
  .strict();
export const BrandBriefResponseSchema = UpsertBrandBriefSchema.extend({
  id: z.string(),
  projectId: z.string(),
  visualStyle: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const MeResponseSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  isDemo: z.boolean(),
  plan: PlanKeySchema,
  createdAt: z.iso.datetime(),
});
export const WebhookAcknowledgementSchema = z.object({ received: z.literal(true) });
export type WebhookAcknowledgement = z.infer<typeof WebhookAcknowledgementSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;
export type UpsertBrandBriefInput = z.infer<typeof UpsertBrandBriefSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type BrandBriefResponse = z.infer<typeof BrandBriefResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
