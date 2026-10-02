const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });
  const client = await pool.connect();
  const userId = randomUUID();
  const projectId = randomUUID();
  const generationId = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO "User" (id, "clerkId", "updatedAt") VALUES ($1, $1, now())',
      [userId],
    );
    await client.query(
      'INSERT INTO "Project" (id, "ownerId", name, "updatedAt") VALUES ($1, $2, $1, now())',
      [projectId, userId],
    );
    await client.query(
      'INSERT INTO "BrandBrief" (id, "projectId", product, audience, tone, "updatedAt") VALUES ($1, $2, $3, $3, $3, now())',
      [randomUUID(), projectId, 'Test'],
    );
    const brief = await client.query(
      'SELECT language, "businessAddress" FROM "BrandBrief" WHERE "projectId" = $1',
      [projectId],
    );
    assert.deepEqual(brief.rows, [{ language: 'vi', businessAddress: null }]);
    await client.query(
      'INSERT INTO "Generation" (id, "userId", "projectId", "requestId", input, "briefSnapshot", model, "requestedOutputs") VALUES ($1, $2, $3, $1, $4, $4, $1, 3)',
      [generationId, userId, projectId, {}],
    );

    async function rejectsCheck(sql, params) {
      await client.query('SAVEPOINT invalid_write');
      await assert.rejects(
        client.query(sql, params),
        (error) => error.code === '23514',
      );
      await client.query('ROLLBACK TO SAVEPOINT invalid_write');
    }
    await rejectsCheck(
      'UPDATE "BrandBrief" SET language = $1 WHERE "projectId" = $2',
      ['xx', projectId],
    );
    await rejectsCheck(
      'UPDATE "BrandBrief" SET "businessAddress" = $1 WHERE "projectId" = $2',
      [' ', projectId],
    );
    await rejectsCheck(
      'UPDATE "BrandBrief" SET "businessAddress" = $1 WHERE "projectId" = $2',
      ['x'.repeat(301), projectId],
    );
    await rejectsCheck(
      'UPDATE "Generation" SET "quotaUnits" = 0 WHERE id = $1',
      [generationId],
    );
    await rejectsCheck(
      'UPDATE "Generation" SET "requestedOutputs" = 1 WHERE id = $1',
      [generationId],
    );
    await client.query('SAVEPOINT regeneration');
    await client.query(
      'UPDATE "Generation" SET "requestedOutputs" = 1, "quotaUnits" = 0 WHERE id = $1',
      [generationId],
    );
    await rejectsCheck(
      'UPDATE "Generation" SET kind = \'IMAGE\' WHERE id = $1',
      [generationId],
    );
    await rejectsCheck(
      'UPDATE "Generation" SET "quotaUnits" = -1 WHERE id = $1',
      [generationId],
    );
    await client.query('ROLLBACK TO SAVEPOINT regeneration');
    await rejectsCheck(
      'UPDATE "Generation" SET status = \'SUCCEEDED\', "completedAt" = now() WHERE id = $1',
      [generationId],
    );
    await rejectsCheck(
      "INSERT INTO \"ContentItem\" (id, \"projectId\", channel, title, body, status, \"updatedAt\") VALUES ($1, $2, 'FACEBOOK', 'test', 'test', 'SCHEDULED', now())",
      [randomUUID(), projectId],
    );
    await client.query(
      'INSERT INTO "ContentItem" (id, "projectId", channel, title, body, status, "scheduledAt", "updatedAt") VALUES ($1, $2, \'FACEBOOK\', \'test\', \'test\', \'DRAFT\', now(), now())',
      [randomUUID(), projectId],
    );
    await rejectsCheck(
      'INSERT INTO "ContentItem" (id, "projectId", channel, title, body, status, "scheduledAt", "updatedAt") VALUES ($1, $2, \'FACEBOOK\', \'test\', \'test\', \'READY\', now(), now())',
      [randomUUID(), projectId],
    );
    await rejectsCheck(
      'INSERT INTO "PersonalReference" (id, "userId", kind, title, "updatedAt") VALUES ($1, $2, \'TEXT\', \'missing text\', now())',
      [randomUUID(), userId],
    );
    await client.query('DELETE FROM "Project" WHERE id = $1', [projectId]);
    const log = await client.query(
      'SELECT "projectId", "quotaUnits" FROM "Generation" WHERE id = $1',
      [generationId],
    );
    assert.deepEqual(log.rows, [{ projectId: null, quotaUnits: 1 }]);
    console.log(
      'DB checks passed: brief defaults/constraints and existing invariants; quota log survives project deletion.',
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

run().catch(() => {
  console.error(
    'DB checks failed. Verify database availability and migrations.',
  );
  process.exitCode = 1;
});
