import { z } from 'zod';

export const PlanKeySchema = z.enum(['free', 'pro']);
export type PlanKey = z.infer<typeof PlanKeySchema>;

export const FeatureKeySchema = z.enum([
  'content_generation',
  'image_generation',
  'brand_brief',
  'personalization',
  'content_calendar',
  'more_projects',
  'strong_model',
  'expanded_references',
  'channel_publishing',
  'ai_assistant',
  'content_analytics',
]);
export type FeatureKey = z.infer<typeof FeatureKeySchema>;

export const PlanDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.object({
    amountCents: z.number().int().nonnegative(),
    currency: z.literal('USD'),
    interval: z.literal('month'),
  }).strict(),
  features: z.array(FeatureKeySchema),
}).strict();
export type PlanDefinition = z.infer<typeof PlanDefinitionSchema>;

const baseFeatures: FeatureKey[] = [
  'content_generation', 'image_generation', 'brand_brief',
  'personalization', 'content_calendar',
];

// Product catalog only: Clerk verifies access and owns the checkout price.
export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  free: {
    name: 'Free',
    description: 'Get started with AI-powered marketing content, organize your projects, and personalize your creative workflow.',
    price: { amountCents: 0, currency: 'USD', interval: 'month' },
    features: [...baseFeatures],
  },
  pro: {
    name: 'Pro',
    description: 'Create more, personalize deeper, and manage your marketing across channels—built for marketers, freelancers, and small business owners.',
    price: { amountCents: 1000, currency: 'USD', interval: 'month' },
    features: [...baseFeatures, 'more_projects', 'strong_model',
      'expanded_references', 'channel_publishing', 'ai_assistant', 'content_analytics'],
  },
};
