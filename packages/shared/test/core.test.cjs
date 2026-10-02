const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  CreateProjectSchema,
  UpdateProjectSchema,
  UpsertBrandBriefSchema,
  ProjectListQuerySchema,
  WebhookAcknowledgementSchema,
} = require('../dist/index.js');

test('core contract rejects unsafe writes and normalizes inputs', () => {
  assert.equal(WebhookAcknowledgementSchema.safeParse({ received: false }).success, false);
  assert.deepEqual(WebhookAcknowledgementSchema.parse({ received: true }), { received: true });
  assert.equal(CreateProjectSchema.parse({ name: '  Shop  ' }).name, 'Shop');
  assert.equal(
    CreateProjectSchema.safeParse({ name: 'Shop', ownerId: 'other-user' })
      .success,
    false,
  );
  assert.equal(UpdateProjectSchema.safeParse({}).success, false);
  assert.equal(
    ProjectListQuerySchema.safeParse({ limit: '101' }).success,
    false,
  );
  const brief = UpsertBrandBriefSchema.parse({
    product: 'Shop',
    audience: 'Người mới',
    tone: 'Thân thiện',
  });
  assert.equal(brief.visualStyle, null);
  assert.deepEqual(brief.brandColors, []);
});
