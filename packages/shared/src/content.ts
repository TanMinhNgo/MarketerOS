import { z } from 'zod';

export const ChannelSchema = z.enum([
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'LINKEDIN',
  'YOUTUBE',
  'EMAIL',
  'BLOG',
]);
export const ContentStatusSchema = z.enum([
  'DRAFT',
  'READY',
  'SCHEDULED',
  'DONE',
]);

const text = (max: number) => z.string().trim().min(1).max(max);
export const GeneratedVariantSchema = z
  .object({
    title: text(200),
    body: text(10000),
    hashtags: z.array(text(100)).max(20),
    cta: z.string().trim().max(300),
  })
  .strict();
export const GeneratedVariantsSchema = z
  .object({
    variants: z.array(GeneratedVariantSchema).length(3),
  })
  .strict();
export const GenerateContentInputSchema = z
  .object({
    channel: ChannelSchema,
    goal: text(1000),
    topic: text(1000),
    notes: z.string().trim().max(3000).optional(),
  })
  .strict();
export const VariantDeltaSchema = z
  .object({
    index: z.number().int().min(0).max(2),
    variant: GeneratedVariantSchema.partial(),
  })
  .strict();
export const VariantDoneSchema = z
  .object({
    index: z.number().int().min(0).max(2),
    variant: GeneratedVariantSchema,
  })
  .strict();
export const GenerationDoneSchema = z
  .object({
    generationId: z.string(),
    variants: GeneratedVariantsSchema.shape.variants,
  })
  .strict();

const contentFields = z.object({
  channel: ChannelSchema,
  title: text(200),
  body: text(10000),
  hashtags: z.array(text(100)).max(20),
  cta: z.string().trim().max(300).nullable(),
});
export const CreateContentSchema = contentFields
  .extend({
    hashtags: contentFields.shape.hashtags.default([]),
    cta: contentFields.shape.cta.default(null),
    generationId: z.string().min(1).nullable().default(null),
  })
  .strict();
export const UpdateContentSchema = contentFields
  .pick({
    title: true,
    body: true,
    hashtags: true,
    cta: true,
  })
  .partial()
  .extend({
    status: ContentStatusSchema.optional(),
    scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Cần ít nhất một trường cập nhật.',
  });
export const ContentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: ContentStatusSchema.optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    unscheduled: z.enum(['true', 'false']).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.from === undefined) !== (value.to === undefined))
      context.addIssue({
        code: 'custom',
        path: [value.from === undefined ? 'from' : 'to'],
        message: 'from và to phải đi cùng nhau.',
      });
    if (value.from && value.to) {
      const duration = Date.parse(value.to) - Date.parse(value.from);
      if (duration <= 0 || duration > 62 * 24 * 60 * 60 * 1000)
        context.addIssue({
          code: 'custom',
          path: ['to'],
          message: 'Khoảng thời gian phải lớn hơn 0 và tối đa 62 ngày.',
        });
      if (value.unscheduled === 'true')
        context.addIssue({
          code: 'custom',
          path: ['unscheduled'],
          message: 'Không thể kết hợp unscheduled=true với from/to.',
        });
    }
  });
export const ContentResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  generationId: z.string().nullable(),
  channel: ChannelSchema,
  title: z.string(),
  body: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string().nullable(),
  status: ContentStatusSchema,
  scheduledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const ContentListResponseSchema = z.object({
  items: z.array(ContentResponseSchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export type GenerateContentInput = z.infer<typeof GenerateContentInputSchema>;
export type GeneratedVariant = z.infer<typeof GeneratedVariantSchema>;
export type GeneratedVariants = z.infer<typeof GeneratedVariantsSchema>;
export type CreateContentInput = z.infer<typeof CreateContentSchema>;
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>;
export type ContentListQuery = z.infer<typeof ContentListQuerySchema>;
export type ContentResponse = z.infer<typeof ContentResponseSchema>;
