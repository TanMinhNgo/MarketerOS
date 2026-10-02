const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  GenerateContentInputSchema,
  GeneratedVariantsSchema,
  CreateContentSchema,
  UpdateContentSchema,
  ContentListQuerySchema,
} = require('../dist/index.js');

test('generation and draft contracts reject extra fields and incomplete variants', () => {
  assert.equal(
    GenerateContentInputSchema.safeParse({
      channel: 'FACEBOOK',
      goal: 'Giới thiệu',
      topic: 'Sản phẩm',
      userId: 'other',
    }).success,
    false,
  );
  const variant = { title: 'A', body: 'B', hashtags: [], cta: '' };
  assert.equal(
    GeneratedVariantsSchema.safeParse({ variants: [variant] }).success,
    false,
  );
  assert.equal(
    GeneratedVariantsSchema.safeParse({ variants: [variant, variant, variant] })
      .success,
    true,
  );
  assert.equal(
    CreateContentSchema.parse({
      channel: 'BLOG',
      title: 'A',
      body: 'B',
    }).generationId,
    null,
  );
  assert.equal(UpdateContentSchema.safeParse({}).success, false);
  assert.equal(
    UpdateContentSchema.safeParse({ status: 'READY' }).success,
    true,
  );
  assert.equal(
    UpdateContentSchema.safeParse({ scheduledAt: null }).success,
    true,
  );
  assert.equal(
    UpdateContentSchema.safeParse({ scheduledAt: '2026-10-20T17:00:00+07:00' })
      .success,
    true,
  );
  assert.equal(
    UpdateContentSchema.safeParse({ status: 'READY', extra: 1 }).success,
    false,
  );
});

test('calendar query requires a bounded date range', () => {
  const from = '2026-10-01T00:00:00.000Z';
  const to = '2026-12-02T00:00:00.000Z';
  assert.equal(ContentListQuerySchema.safeParse({ from, to }).success, true);
  assert.equal(
    ContentListQuerySchema.safeParse({ from: '2026-10-01T07:00:00+07:00', to })
      .success,
    true,
  );
  assert.equal(ContentListQuerySchema.safeParse({ from }).success, false);
  assert.equal(
    ContentListQuerySchema.safeParse({ from, to: '2026-12-03T00:00:00.000Z' })
      .success,
    false,
  );
  assert.equal(
    ContentListQuerySchema.safeParse({ from, to, unscheduled: 'true' }).success,
    false,
  );
  assert.equal(
    ContentListQuerySchema.safeParse({ unscheduled: 'true' }).success,
    true,
  );
});
