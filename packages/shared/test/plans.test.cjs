const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PLAN_CATALOG, PlanKeySchema, FeatureKeySchema, PlanDefinitionSchema } = require('../dist/index.js');

test('plan catalog matches the Free/Pro product contract', () => {
  assert.deepEqual(Object.keys(PLAN_CATALOG), ['free', 'pro']);
  assert.equal(PlanKeySchema.safeParse('demo').success, false);
  assert.equal(FeatureKeySchema.safeParse('unknown').success, false);
  for (const plan of Object.values(PLAN_CATALOG)) {
    PlanDefinitionSchema.parse(plan);
    assert.equal(new Set(plan.features).size, plan.features.length);
  }
  assert.equal(PLAN_CATALOG.free.price.amountCents, 0);
  assert.deepEqual(PLAN_CATALOG.pro.price, { amountCents: 1000, currency: 'USD', interval: 'month' });
  assert.deepEqual(PLAN_CATALOG.free.features, [
    'content_generation', 'image_generation', 'brand_brief', 'personalization', 'content_calendar',
  ]);
  assert.deepEqual(PLAN_CATALOG.pro.features, [...PLAN_CATALOG.free.features,
    'more_projects', 'strong_model', 'expanded_references', 'channel_publishing', 'ai_assistant', 'content_analytics',
  ]);
});
