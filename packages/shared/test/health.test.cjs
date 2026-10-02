const assert = require('node:assert/strict');
const { test } = require('node:test');
const { HealthResponseSchema } = require('../dist/index.js');

test('health contract accepts database status and rejects invalid responses', () => {
  for (const db of ['up', 'down']) {
    assert.deepEqual(HealthResponseSchema.parse({ status: 'ok', db }), {
      status: 'ok',
      db,
    });
  }
  assert.equal(
    HealthResponseSchema.safeParse({ status: 'error', db: 'up' }).success,
    false,
  );
  assert.equal(
    HealthResponseSchema.safeParse({ status: 'ok', db: 'unknown' }).success,
    false,
  );
  assert.equal(HealthResponseSchema.safeParse({ status: 'ok' }).success, false);
});
