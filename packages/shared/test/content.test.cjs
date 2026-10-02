const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  GenerateContentInputSchema,
  GeneratedVariantsSchema,
  CreateContentSchema,
  UpdateContentSchema,
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
});
