import { z } from 'zod';
import { FeatureKeySchema, PlanKeySchema } from './plans';

const UsageCounterSchema = z
  .object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  })
  .strict();

export const BillingUsageResponseSchema = z
  .object({
    plan: PlanKeySchema,
    features: z.array(FeatureKeySchema),
    period: z
      .object({ start: z.iso.datetime(), end: z.iso.datetime() })
      .strict(),
    usage: z
      .object({
        projects: UsageCounterSchema,
        text: UsageCounterSchema,
        assistant: UsageCounterSchema.optional(),
        automationRuns: UsageCounterSchema.optional(),
        automations: UsageCounterSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type BillingUsageResponse = z.infer<typeof BillingUsageResponseSchema>;

export const PlanLimitDetailsSchema = UsageCounterSchema.extend({
  plan: PlanKeySchema,
});
export type PlanLimitDetails = z.infer<typeof PlanLimitDetailsSchema>;
