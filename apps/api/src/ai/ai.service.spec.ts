import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth.decorators';
import { AiRepository } from './ai.repository';
import { AiService } from './ai.service';
import { OpenAiService } from './openai.service';
import { PromptBuilder } from './prompt-builder';
import { QuotaService } from './quota.service';

const variant = {
  title: 'Tiêu đề',
  body: `Hook ngắn\n${Array(80).fill('Nội-dung').join(' ')}`,
  hashtags: ['ThẻMột', 'ThẻHai'],
  cta: 'Khám phá ngay',
};
const output = { variants: [variant, variant, variant] };
const user = { id: 'user_1', plan: 'free' } as AuthUser;
const prepared = {
  generationId: 'gen_1',
  channel: 'FACEBOOK' as const,
  avoidWords: [],
  system: 'system',
  prompt: 'prompt',
};

function setup(
  replies: { finishReason: string; generated: typeof output }[] = [
    { finishReason: 'stop', generated: output },
  ],
) {
  const repository = {
    brief: jest.fn().mockResolvedValue({
      product: 'Shop',
      audience: 'Người mới',
      tone: 'Thân thiện',
      keyMessages: [],
      avoidWords: [],
      samplePosts: [],
    }),
    reserve: jest.fn().mockResolvedValue({ id: 'gen_1' }),
    finish: jest.fn().mockResolvedValue({ count: 1 }),
  };
  let call = 0;
  const openai = {
    stream: jest.fn().mockImplementation(() => {
      const reply = replies[Math.min(call++, replies.length - 1)];
      return {
        partialOutputStream: (async function* () {
          yield { variants: [{ title: 'Tiêu' }] };
          await Promise.resolve();
          yield reply.generated;
        })(),
        output: Promise.resolve(reply.generated),
        finishReason: Promise.resolve(reply.finishReason),
        usage: Promise.resolve({ inputTokens: 11, outputTokens: 23 }),
      };
    }),
  };
  const service = new AiService(
    repository as unknown as AiRepository,
    openai as unknown as OpenAiService,
    new PromptBuilder(),
    new QuotaService(),
    { getOrThrow: () => 'test-model' } as unknown as ConfigService,
  );
  return { service, repository, openai };
}

test('streams partial variants then persists measured usage and completion', async () => {
  const { service, repository, openai } = setup();
  await service.prepare('project_1', user, 'request_1', {
    channel: 'FACEBOOK',
    goal: 'Giới thiệu',
    topic: 'Shop',
  });
  const events = [];
  for await (const event of service.stream(
    prepared,
    new AbortController().signal,
  ))
    events.push(event);
  expect(events.map((event) => event.event)).toEqual([
    'variant.delta',
    'variant.delta',
    'variant.delta',
    'variant.delta',
    'variant.done',
    'variant.done',
    'variant.done',
    'done',
  ]);
  expect(openai.stream).toHaveBeenCalledTimes(1);
  expect(repository.reserve).toHaveBeenCalledWith(
    'project_1',
    'user_1',
    'request_1',
    expect.anything(),
    expect.anything(),
    'test-model',
    10,
    expect.any(Date),
    expect.any(Date),
  );
  expect(repository.finish).toHaveBeenCalledWith(
    'gen_1',
    'SUCCEEDED',
    11,
    23,
    null,
  );
});

test('repairs a hard violation once without another quota reservation', async () => {
  const bad = { variants: [{ ...variant, body: 'RẺ NHẤT' }, variant, variant] };
  const { service, repository, openai } = setup([
    { finishReason: 'stop', generated: bad },
    { finishReason: 'stop', generated: output },
  ]);
  const events = [];
  for await (const event of service.stream(
    { ...prepared, avoidWords: ['rẻ nhất'] },
    new AbortController().signal,
  ))
    events.push(event);
  expect(openai.stream).toHaveBeenCalledTimes(2);
  expect(openai.stream).toHaveBeenNthCalledWith(
    2,
    prepared.system,
    expect.stringContaining('từ/cụm bị cấm'),
    expect.any(AbortSignal),
  );
  expect(repository.reserve).not.toHaveBeenCalled();
  expect(repository.finish).toHaveBeenCalledWith(
    'gen_1',
    'SUCCEEDED',
    22,
    46,
    null,
  );
  expect(events.at(-1)?.event).toBe('done');
});

test('does not mark truncated model output as successful after one repair', async () => {
  const { service, repository, openai } = setup([
    { finishReason: 'length', generated: output },
  ]);
  const events = [];
  for await (const event of service.stream(
    prepared,
    new AbortController().signal,
  ))
    events.push(event);
  expect(events.at(-1)?.event).toBe('error');
  expect(openai.stream).toHaveBeenCalledTimes(2);
  expect(repository.finish).toHaveBeenCalledWith(
    'gen_1',
    'FAILED',
    22,
    46,
    'AI_GENERATION_FAILED',
  );
});

test('emits error after two invalid outputs and never emits variant.done', async () => {
  const { service, repository, openai } = setup([
    {
      finishReason: 'stop',
      generated: {
        variants: [
          { ...variant, body: 'Đây là sản phẩm rẻ nhất' },
          variant,
          variant,
        ],
      },
    },
  ]);
  const events = [];
  for await (const event of service.stream(
    { ...prepared, avoidWords: ['rẻ nhất'] },
    new AbortController().signal,
  ))
    events.push(event);
  expect(events.at(-1)?.event).toBe('error');
  expect(openai.stream).toHaveBeenCalledTimes(2);
  expect(events.some((event) => event.event === 'done')).toBe(false);
  expect(events.some((event) => event.event === 'variant.done')).toBe(false);
  expect(repository.finish).toHaveBeenCalledWith(
    'gen_1',
    'FAILED',
    22,
    46,
    'AI_GENERATION_FAILED',
  );
});
