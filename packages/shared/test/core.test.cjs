const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  CreateProjectSchema,
  UpdateProjectSchema,
  UpsertBrandBriefSchema,
  BrandBriefResponseSchema,
  ContentLanguageSchema,
  ProjectListQuerySchema,
  WebhookAcknowledgementSchema,
} = require('../dist/index.js');

test('core contract rejects unsafe writes and normalizes inputs', () => {
  assert.equal(
    WebhookAcknowledgementSchema.safeParse({ received: false }).success,
    false,
  );
  assert.deepEqual(WebhookAcknowledgementSchema.parse({ received: true }), {
    received: true,
  });
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
  assert.equal(brief.language, 'vi');
  assert.equal(brief.businessAddress, null);
  assert.equal(ContentLanguageSchema.safeParse('xx').success, false);
  assert.equal(
    UpsertBrandBriefSchema.parse({
      product: 'Shop',
      audience: 'Người mới',
      tone: 'Thân thiện',
      language: 'en',
      businessAddress: '  123 Main St  ',
    }).businessAddress,
    '123 Main St',
  );
  assert.equal(
    UpsertBrandBriefSchema.parse({
      product: 'Shop',
      audience: 'Người mới',
      tone: 'Thân thiện',
      businessAddress: '   ',
    }).businessAddress,
    null,
  );
  assert.equal(
    UpsertBrandBriefSchema.safeParse({
      product: 'Shop',
      audience: 'Người mới',
      tone: 'Thân thiện',
      businessAddress: 'x'.repeat(301),
    }).success,
    false,
  );
  assert.equal(
    BrandBriefResponseSchema.safeParse({
      ...brief,
      language: undefined,
      id: 'b',
      projectId: 'p',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).success,
    false,
  );
});
