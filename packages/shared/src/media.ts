import { z } from 'zod';

export const AssetKindSchema = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']);
export const AssetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  generationId: z.string().nullable(),
  kind: AssetKindSchema,
  name: z.string(),
  mimeType: z.string(),
  byteSize: z.string().regex(/^\d+$/),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  altText: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AssetListQuerySchema = z
  .object({
    kind: AssetKindSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    before: z.string().optional(),
  })
  .strict();
export type AssetListQuery = z.infer<typeof AssetListQuerySchema>;
export const AssetListResponseSchema = z.object({
  items: z.array(AssetSchema),
  hasMore: z.boolean(),
});
export const AssetUrlResponseSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export const GenerateImageInputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    name: z.string().trim().min(1).max(200).optional(),
    size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1024x1024'),
  })
  .strict();
export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;

export const ReplaceContentAssetsSchema = z
  .object({
    assetIds: z
      .array(z.string().min(1))
      .max(10)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Asset IDs must be unique.',
      ),
  })
  .strict();
export type ReplaceContentAssetsInput = z.infer<
  typeof ReplaceContentAssetsSchema
>;
export const ContentAssetsResponseSchema = z.object({
  items: z.array(AssetSchema),
});
