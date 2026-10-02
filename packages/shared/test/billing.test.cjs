const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BillingUsageResponseSchema, PlanLimitDetailsSchema } = require('../dist/index.js');

test('billing usage permits downgrade overage but rejects unknown limits and entitlements', () => {
  const response = {
    plan: 'free', features: [],
    period: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' },
    usage: { projects: { used: 20, limit: 3 }, text: { used: 0, limit: 10 } },
  };
  assert.deepEqual(BillingUsageResponseSchema.parse(response), response);
  for (const invalid of [
    { ...response, features: ['unknown'] },
    { ...response, image: { used: 0, limit: 2 } },
    { ...response, usage: { ...response.usage, image: { used: 0, limit: 2 } } },
    { ...response, usage: { ...response.usage, text: { used: -1, limit: 10 } } },
    { ...response, usage: { ...response.usage, text: { used: 0.5, limit: 10 } } },
    { ...response, period: { ...response.period, start: 'invalid' } },
  ]) assert.equal(BillingUsageResponseSchema.safeParse(invalid).success, false);
  assert.equal(PlanLimitDetailsSchema.safeParse({ limit: 3, used: 3, plan: 'free', extra: true }).success, false);
});
