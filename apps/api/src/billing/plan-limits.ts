import type { PlanKey } from '@marketos/shared';

export const PLAN_LIMITS = {
  free: { projects: 3, text: 10 },
  pro: { projects: 20, text: 200 },
} as const satisfies Record<PlanKey, { projects: number; text: number }>;
