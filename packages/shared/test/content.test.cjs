const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  GenerateContentInputSchema,
  GeneratedVariantsSchema,
  CreateContentSchema,
  UpdateContentSchema,
  ContentListQuerySchema,
  GenerateVariantInputSchema,
  SingleVariantOutputSchema,
  SingleVariantDoneSchema,
} = require('../dist/index.js');

test('single-variant contracts enforce strict input, index and output cardinality', () => {
  const variant = { title: 'A', body: 'B', hashtags: [], cta: '' };
  const body = {
    input: { channel: 'FACEBOOK', goal: 'G', topic: 'T' },
    others: [],
    index: 2,
  };
  for (const others of [[], [variant], [variant, variant]]) {
    for (const index of [0, 1, 2])
      assert.equal(
        GenerateVariantInputSchema.safeParse({ ...body, others, index })
          .success,
        true,
      );
  }
  for (const invalid of [
    { ...body, others: [variant, variant, variant] },
    { ...body, index: 3 },
    { ...body, index: 1.5 },
    { ...body, extra: true },
    { ...body, input: { ...body.input, extra: true } },
    { ...body, others: [{ ...variant, extra: true }] },
    { input: body.input, index: 0 },
  ])
    assert.equal(GenerateVariantInputSchema.safeParse(invalid).success, false);
  for (const variants of [[], [variant, variant, variant]]) {
    assert.equal(
      SingleVariantOutputSchema.safeParse({ variants }).success,
      false,
    );
    assert.equal(
      SingleVariantDoneSchema.safeParse({ generationId: 'g', variants })
        .success,
      false,
    );
  }
  assert.equal(
    SingleVariantDoneSchema.safeParse({
      generationId: 'g',
      variants: [variant],
    }).success,
    true,
  );
});

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
