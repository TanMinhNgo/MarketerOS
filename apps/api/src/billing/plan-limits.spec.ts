import { ForbiddenException } from '@nestjs/common';
import { PlanLimitDetailsSchema } from '@marketos/shared';
import { PLAN_LIMITS } from './plan-limits';
import { requireFeature } from '../auth/require-feature';

test('only confirmed project and TEXT limits are configured', () => {
  expect(PLAN_LIMITS).toEqual({
    free: { projects: 3, text: 10 },
    pro: { projects: 20, text: 200, assistant: 300 },
    max: {
      projects: 50,
      text: 500,
      assistant: 1000,
      automations: 10,
      automationRuns: 60,
    },
  });
  expect(
    PlanLimitDetailsSchema.parse({ limit: 3, used: 20, plan: 'free' }),
  ).toEqual({ limit: 3, used: 20, plan: 'free' });
});

test('feature checks use verified entitlements and deny with PLAN_REQUIRED', () => {
  expect(() =>
    requireFeature({ features: ['brand_brief'] }, 'brand_brief'),
  ).not.toThrow();
  try {
    requireFeature({ features: [] }, 'brand_brief');
    throw new Error('Expected denial');
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      code: 'PLAN_REQUIRED',
      message: expect.any(String) as unknown,
      details: { feature: 'brand_brief' },
    });
  }
});
