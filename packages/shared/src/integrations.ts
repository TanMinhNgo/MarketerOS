import { z } from 'zod';

export const IntegrationChannelSchema = z.enum([
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'EMAIL',
]);
export const IntegrationProviderSchema = z.enum([
  'facebook',
  'instagram',
  'linkedin',
  'smtp',
]);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;
export const INTEGRATION_PROVIDERS = [
  {
    provider: 'facebook',
    channel: 'FACEBOOK',
    name: 'Facebook Page',
    blurb:
      'Publish approved posts to a Page you manage and bring post stats into Reports.',
  },
  {
    provider: 'instagram',
    channel: 'INSTAGRAM',
    name: 'Instagram Professional',
    blurb:
      'Publish approved image posts to a Business or Creator account linked to a Facebook Page.',
  },
  {
    provider: 'linkedin',
    channel: 'LINKEDIN',
    name: 'LinkedIn',
    blurb:
      'Publish approved posts to your personal profile. Post stats are not available.',
  },
  {
    provider: 'smtp',
    channel: 'EMAIL',
    name: 'Email (SMTP)',
    blurb: 'Send approved plain-text email through the configured SMTP sender.',
  },
] as const;
export const IntegrationProvidersResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          provider: IntegrationProviderSchema,
          channel: IntegrationChannelSchema,
          name: z.string(),
          blurb: z.string(),
          configured: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export const ConnectionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  channel: IntegrationChannelSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  externalUrl: z.string().nullable(),
  status: z.enum(['CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR']),
  connectedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  lastSyncedAt: z.iso.datetime().nullable(),
});
export const ConnectionsResponseSchema = z.object({
  items: z.array(ConnectionSchema),
});
export const OAuthStartResponseSchema = z.object({ authUrl: z.url() });
export const PublishEmailSchema = z.object({ to: z.email().max(254) }).strict();
export const PublishInputSchema = z
  .object({ email: PublishEmailSchema.optional() })
  .strict()
  .default({});
export type PublishInput = z.infer<typeof PublishInputSchema>;
export const FacebookPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export const FacebookPagesResponseSchema = z.object({
  items: z.array(FacebookPageSchema),
});
export const SelectFacebookPageSchema = z
  .object({ session: z.string().min(1), pageId: z.string().min(1) })
  .strict();
export const PublicationMetricSchema = z.object({
  measuredAt: z.iso.datetime(),
  impressions: z.string().nullable(),
  reach: z.string().nullable(),
  clicks: z.string().nullable(),
  likes: z.string().nullable(),
  comments: z.string().nullable(),
  shares: z.string().nullable(),
});
export const PublicationSchema = z.object({
  id: z.string(),
  contentId: z.string().nullable(),
  connectionId: z.string(),
  channel: IntegrationChannelSchema,
  status: z.enum(['QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED']),
  scheduledAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  externalUrl: z.string().nullable(),
  errorCode: z
    .enum([
      'TOKEN_EXPIRED',
      'PERMISSION_DENIED',
      'RATE_LIMITED',
      'CONTENT_REJECTED',
      'PROVIDER_ERROR',
    ])
    .nullable(),
  title: z.string(),
  latestMetric: PublicationMetricSchema.nullable(),
});
export const PublicationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().optional(),
  contentId: z.string().optional(),
});
export const PublicationsResponseSchema = z.object({
  items: z.array(PublicationSchema),
  hasMore: z.boolean(),
});
export type IntegrationChannel = z.infer<typeof IntegrationChannelSchema>;
export type PublicationsQuery = z.infer<typeof PublicationsQuerySchema>;
export type SelectFacebookPageInput = z.infer<typeof SelectFacebookPageSchema>;
