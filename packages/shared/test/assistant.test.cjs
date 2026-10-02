const assert = require('node:assert/strict');
const { test } = require('node:test');
const { z } = require('zod');
const { AssistantActionSchema, AssistantMessageInputSchema, AssistantOutputSchema, AssistantMessagesResponseSchema, BillingUsageResponseSchema } = require('../dist');

test('assistant strict contracts only allow supported proposals and preserve partial changes', () => {
  const base = { id: 'a', status: 'proposed' };
  assert.deepEqual(AssistantActionSchema.parse({ ...base, type: 'update_brief', changes: { tone: 'New tone' } }).changes, { tone: 'New tone' });
  assert.deepEqual(AssistantActionSchema.parse({ ...base, type: 'edit_content', contentId: 'c', title: 'New title' }), { ...base, type: 'edit_content', contentId: 'c', title: 'New title' });
  for (const action of [
    { ...base, type: 'delete', contentId: 'c' },
    { ...base, type: 'update_brief', changes: {} },
    { ...base, type: 'update_brief', changes: { plan: 'pro' } },
    { ...base, type: 'edit_content', contentId: 'c' },
    { ...base, type: 'edit_content', contentId: 'c', body: 'Text', status: 'DONE' },
    { ...base, type: 'schedule', contentId: 'c', scheduledAt: 'bad-date' },
  ]) assert.equal(AssistantActionSchema.safeParse(action).success, false);
  for (const content of ['', ' ', 'x'.repeat(4001)]) assert.equal(AssistantMessageInputSchema.safeParse({ content }).success, false);
  assert.equal(AssistantMessageInputSchema.safeParse({ content: 'Hi', projectId: 'hijack' }).success, false);
  assert.equal(AssistantOutputSchema.safeParse({ text: 'Hi', actions: [] }).success, true);
  // The installed AI SDK serializes Zod in input mode for structured output.
  assert.doesNotThrow(() => z.toJSONSchema(AssistantOutputSchema, { io: 'input' }));
  assert.doesNotThrow(() => z.toJSONSchema(AssistantMessagesResponseSchema, { io: 'output' }));
  const usage = { plan: 'pro', features: ['ai_assistant'], period: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' }, usage: { projects: { used: 1, limit: 20 }, text: { used: 2, limit: 200 }, assistant: { used: 3, limit: 300 } } };
  assert.deepEqual(BillingUsageResponseSchema.parse(usage), usage);
});
