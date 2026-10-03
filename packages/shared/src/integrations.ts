import { z } from 'zod';

export const IntegrationChannelSchema = z.enum(['FACEBOOK', 'LINKEDIN']);
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
