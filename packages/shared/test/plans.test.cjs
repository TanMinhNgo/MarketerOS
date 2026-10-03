const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  PLAN_CATALOG,
  PLAN_LIMITS,
  PlanKeySchema,
  FeatureKeySchema,
  PlanDefinitionSchema,
} = require('../dist/index.js');

test('plan catalog and enforced limits describe Free, Pro and Max consistently', () => {
  assert.deepEqual(Object.keys(PLAN_CATALOG), ['free', 'pro', 'max']);
  assert.equal(PlanKeySchema.safeParse('demo').success, false);
  assert.equal(FeatureKeySchema.safeParse('unknown').success, false);
  for (const plan of Object.values(PLAN_CATALOG)) {
    PlanDefinitionSchema.parse(plan);
    assert.equal(new Set(plan.features).size, plan.features.length);
  }
  assert.equal(PLAN_CATALOG.free.price.amountCents, 0);
  assert.equal(PLAN_CATALOG.max.price.amountCents, 2500);
  for (const key of Object.keys(PLAN_CATALOG)) {
    assert.deepEqual(PLAN_CATALOG[key].limits, PLAN_LIMITS[key]);
  }
  for (const amount of Object.values(PLAN_LIMITS.max)) {
    assert.match(PLAN_CATALOG.max.description, new RegExp(`\\b${amount}\\b`));
  }
  assert.deepEqual(PLAN_CATALOG.max.features, [
    ...PLAN_CATALOG.pro.features,
    'automation',
  ]);
  assert.deepEqual(PLAN_CATALOG.pro.price, {
    amountCents: 1000,
    currency: 'USD',
    interval: 'month',
  });
  assert.deepEqual(PLAN_CATALOG.free.features, [
    'content_generation',
    'image_generation',
    'brand_brief',
    'personalization',
    'content_calendar',
  ]);
  assert.deepEqual(PLAN_CATALOG.pro.features, [
    ...PLAN_CATALOG.free.features,
    'more_projects',
    'strong_model',
    'expanded_references',
    'channel_publishing',
    'ai_assistant',
    'content_analytics',
  ]);
});
