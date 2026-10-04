import { z } from 'zod';

export const PlanKeySchema = z.enum(['free', 'pro', 'max']);
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
  'automation',
]);
export type FeatureKey = z.infer<typeof FeatureKeySchema>;

// The same limits drive API enforcement, usage responses, and plan copy.
export const PLAN_LIMITS = {
  free: { projects: 3, text: 10, images: 5 },
  pro: { projects: 20, text: 200, images: 50, assistant: 300 },
  max: {
    projects: 50,
    text: 500,
    images: 200,
    assistant: 1000,
    automations: 10,
    automationRuns: 60,
  },
} as const satisfies Record<
  PlanKey,
  {
    projects: number;
    text: number;
    images: number;
    assistant?: number;
    automations?: number;
    automationRuns?: number;
  }
>;

export const PlanLimitsSchema = z
  .object({
    projects: z.number().int().positive(),
    text: z.number().int().positive(),
    images: z.number().int().positive(),
    assistant: z.number().int().positive().optional(),
    automations: z.number().int().positive().optional(),
    automationRuns: z.number().int().positive().optional(),
  })
  .strict();
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

export const PlanDefinitionSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    price: z
      .object({
        amountCents: z.number().int().nonnegative(),
        currency: z.literal('USD'),
        interval: z.literal('month'),
      })
      .strict(),
    limits: PlanLimitsSchema,
    features: z.array(FeatureKeySchema),
  })
  .strict();
export type PlanDefinition = z.infer<typeof PlanDefinitionSchema>;

const baseFeatures: FeatureKey[] = [
  'content_generation',
  'image_generation',
  'brand_brief',
  'personalization',
  'content_calendar',
];

// Product catalog only: Clerk verifies access and owns the checkout price.
export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  free: {
    name: 'Free',
    description:
      'Get started with AI-powered marketing content, organize your projects, and personalize your creative workflow.',
    price: { amountCents: 0, currency: 'USD', interval: 'month' },
    limits: PLAN_LIMITS.free,
    features: [...baseFeatures],
  },
  pro: {
    name: 'Pro',
    description:
      'Create more, personalize deeper, and manage your marketing across channels—built for marketers, freelancers, and small business owners.',
    price: { amountCents: 1000, currency: 'USD', interval: 'month' },
    limits: PLAN_LIMITS.pro,
    features: [
      ...baseFeatures,
      'more_projects',
      'strong_model',
      'expanded_references',
      'channel_publishing',
      'ai_assistant',
      'content_analytics',
    ],
  },
  max: {
    name: 'Max',
    description: `Everything in Pro, plus up to ${PLAN_LIMITS.max.projects} active projects and ${PLAN_LIMITS.max.automations} active automations. Each UTC month includes ${PLAN_LIMITS.max.text} AI content generations, ${PLAN_LIMITS.max.images} images, ${PLAN_LIMITS.max.assistant} Assistant messages and ${PLAN_LIMITS.max.automationRuns} automation runs. Drafts still require your review.`,
    price: { amountCents: 2500, currency: 'USD', interval: 'month' },
    limits: PLAN_LIMITS.max,
    features: [
      ...baseFeatures,
      'more_projects',
      'strong_model',
      'expanded_references',
      'channel_publishing',
      'ai_assistant',
      'content_analytics',
      'automation',
    ],
  },
};
