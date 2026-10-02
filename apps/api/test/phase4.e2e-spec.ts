import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import { OpenAiService } from '../src/ai/openai.service';
import { AiRepository } from '../src/ai/ai.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';
import {
  ContentListResponseSchema,
  ContentResponseSchema,
} from '@marketos/shared';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Phase 4 AI and draft content with PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ai: AiRepository;
  let projectId: string;
  let generationId: string;
  const a = `user_phase4_${randomUUID()}`;
  const b = `user_phase4_${randomUUID()}`;
  const auth = (clerkId: string) => ({ Authorization: `Bearer ${clerkId}` });
  const variant = {
    title: 'Học marketing',
    body: `Bắt đầu hôm nay\n${Array(80).fill('Nội-dung').join(' ')}`,
    hashtags: ['ThẻMột', 'ThẻHai'],
    cta: 'Tìm hiểu thêm',
  };
  const output = { variants: [variant, variant, variant] };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkGateway)
      .useValue({
        authenticate: (header: string) => {
          const clerkId = header.slice(7);
          if (![a, b].includes(clerkId)) throw new UnauthorizedException();
          return Promise.resolve({ clerkId, plan: 'free' });
        },
        profile: () => Promise.resolve({ email: null, name: 'Test' }),
      })
      .overrideProvider(OpenAiService)
      .useValue({
        stream: () => ({
          partialOutputStream: (async function* () {
            yield { variants: [{ title: 'Học' }] };
            await delay(60);
            yield output;
          })(),
          output: Promise.resolve(output),
          finishReason: Promise.resolve('stop'),
          usage: Promise.resolve({ inputTokens: 12, outputTokens: 34 }),
        }),
      })
      .compile();
    prisma = module.get(PrismaService);
    ai = module.get(AiRepository);
    await prisma.$connect();
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    await request(app.getHttpServer()).get('/api/me').set(auth(a)).expect(200);
    await request(app.getHttpServer()).get('/api/me').set(auth(b)).expect(200);
    const created = await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(a))
      .send({ name: 'Test Phase 4' })
      .expect(201);
    projectId = (created.body as { id: string }).id;
  });

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { clerkId: { in: [a, b] } } });
    if (app) await app.close();
  });

  it('rejects missing brief, invalid request ID, and another owner before calling AI', async () => {
    const path = `/api/projects/${projectId}/generate`;
    const input = {
      channel: 'FACEBOOK',
      goal: 'Giới thiệu',
      topic: 'Khóa học',
    };
    await request(app.getHttpServer())
      .post(path)
      .set(auth(a))
      .send(input)
      .expect(400);
    await request(app.getHttpServer())
      .post(path)
      .set(auth(b))
      .set('Idempotency-Key', randomUUID())
      .send(input)
      .expect(404);
    await request(app.getHttpServer())
      .post(path)
      .set(auth(a))
      .set('Idempotency-Key', randomUUID())
      .send(input)
      .expect(404);
  });

  it('streams an early partial event and records a successful generation', async () => {
    await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/brand-brief`)
      .set(auth(a))
      .send({
        product: 'Khóa học',
        audience: 'Người mới',
        tone: 'Thân thiện',
      })
      .expect(200);
    const address = (app.getHttpServer() as Server).address();
    if (!address || typeof address === 'string')
      throw new Error('No test port');
    const requestId = randomUUID();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/projects/${projectId}/generate`,
      {
        method: 'POST',
        headers: {
          ...auth(a),
          'Content-Type': 'application/json',
          'Idempotency-Key': requestId,
        },
        body: JSON.stringify({
          channel: 'FACEBOOK',
          goal: 'Giới thiệu',
          topic: 'Khóa học',
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const first = await reader.read();
    const firstText = new TextDecoder().decode(first.value as Uint8Array);
    expect(firstText).toContain('event: variant.delta');
    expect(firstText).not.toContain('event: done');
    let stream = firstText;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      stream += new TextDecoder().decode(chunk.value as Uint8Array);
    }
    expect(stream).toContain('event: variant.done');
    expect(stream).toContain('event: done');
    const done = stream.match(/event: done\ndata: ([^\n]+)/);
    expect(done).not.toBeNull();
    generationId = (JSON.parse(done![1]) as { generationId: string })
      .generationId;
    const generation = await prisma.generation.findUniqueOrThrow({
      where: { id: generationId },
    });
    expect(generation.status).toBe('SUCCEEDED');
    expect(generation.quotaUnits).toBe(1);
    expect(generation.tokensIn).toBe(12);
    expect(generation.tokensOut).toBe(34);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/generate`)
      .set(auth(a))
      .set('Idempotency-Key', requestId)
      .send({ channel: 'FACEBOOK', goal: 'Giới thiệu', topic: 'Khóa học' })
      .expect(409);
  });

  it('saves, edits, lists and deletes a draft with owner checks', async () => {
    const path = `/api/projects/${projectId}/contents`;
    const created = await request(app.getHttpServer())
      .post(path)
      .set(auth(a))
      .send({ channel: 'FACEBOOK', ...variant, generationId })
      .expect(201);
    const content = ContentResponseSchema.parse(created.body);
    expect(content.status).toBe('DRAFT');
    await request(app.getHttpServer())
      .post(path)
      .set(auth(a))
      .send({ channel: 'BLOG', ...variant, generationId })
      .expect(404);
    await request(app.getHttpServer())
      .get(`${path}?status=DRAFT`)
      .set(auth(a))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${path}/${content.id}`)
      .set(auth(a))
      .send({ body: 'Đã chỉnh sửa' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`${path}/${content.id}`)
      .set(auth(b))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${path}/${content.id}`)
      .set(auth(a))
      .expect(200);
    await request(app.getHttpServer())
      .get(`${path}/${content.id}`)
      .set(auth(a))
      .expect(404);
  });

  it('requires approval before scheduling and re-approval after editing', async () => {
    const path = `/api/projects/${projectId}/contents`;
    const created = await request(app.getHttpServer())
      .post(path)
      .set(auth(a))
      .send({ channel: 'FACEBOOK', ...variant })
      .expect(201);
    const item = `${path}/${(created.body as { id: string }).id}`;
    const patch = (data: object) =>
      request(app.getHttpServer()).patch(item).set(auth(a)).send(data);
    const updated = async (data: object) =>
      ContentResponseSchema.parse((await patch(data).expect(200)).body);
    const conflict = async (data: object) => {
      const response = await patch(data).expect(409);
      const error = response.body as { code: string; details: unknown };
      expect(error.code).toBe('CONFLICT');
      expect(error.details).toBeTruthy();
    };
    const date1 = '2026-10-20T10:00:00.000Z';
    const date2 = '2026-10-21T10:00:00.000Z';

    await conflict({ status: 'SCHEDULED', scheduledAt: date1 });
    await conflict({ status: 'DONE' });
    await conflict({ scheduledAt: date1 });
    expect((await updated({ status: 'READY' })).status).toBe('READY');
    await conflict({ status: 'DONE' });
    await conflict({ status: 'SCHEDULED' });
    await conflict({ body: 'Edited', status: 'READY' });
    const scheduled = await updated({
      status: 'SCHEDULED',
      scheduledAt: date1,
    });
    expect(scheduled).toMatchObject({
      status: 'SCHEDULED',
      scheduledAt: date1,
    });
    expect(await updated({ scheduledAt: date2 })).toMatchObject({
      status: 'SCHEDULED',
      scheduledAt: date2,
    });
    await conflict({ status: 'DRAFT' });
    const done = await updated({ status: 'DONE' });
    expect(done).toMatchObject({ status: 'DONE', scheduledAt: date2 });
    await conflict({ title: 'No edit' });
    await conflict({ status: 'DRAFT' });
    await conflict({ scheduledAt: null });
    expect(await updated({ scheduledAt: date1 })).toMatchObject({
      status: 'DONE',
      scheduledAt: date1,
    });
    expect((await updated({ status: 'SCHEDULED' })).status).toBe('SCHEDULED');
    expect(await updated({ status: 'READY' })).toMatchObject({
      status: 'READY',
      scheduledAt: null,
    });
    expect((await updated({ status: 'DRAFT' })).status).toBe('DRAFT');
    expect((await updated({ status: 'READY' })).status).toBe('READY');
    expect(await updated({ body: 'Needs review' })).toMatchObject({
      status: 'DRAFT',
      scheduledAt: null,
    });
    await updated({ status: 'READY' });
    await updated({ status: 'SCHEDULED', scheduledAt: date2 });
    expect(await updated({ hashtags: ['review'] })).toMatchObject({
      status: 'DRAFT',
      scheduledAt: date2,
    });
    await conflict({ status: 'SCHEDULED' });
    expect(await updated({ status: 'READY' })).toMatchObject({
      status: 'READY',
      scheduledAt: null,
    });
    await request(app.getHttpServer())
      .patch(item)
      .set(auth(b))
      .send({ status: 'DRAFT' })
      .expect(404);
  });

  it('filters the calendar by scheduledAt and returns unscheduled content', async () => {
    const path = `/api/projects/${projectId}/contents`;
    const create = async () => {
      const response = await request(app.getHttpServer())
        .post(path)
        .set(auth(a))
        .send({ channel: 'FACEBOOK', ...variant })
        .expect(201);
      return (response.body as { id: string }).id;
    };
    const inside = await create();
    const outside = await create();
    const noDate = await create();
    for (const [id, date] of [
      [inside, '2026-10-20T10:00:00.000Z'],
      [outside, '2026-11-20T10:00:00.000Z'],
    ]) {
      await request(app.getHttpServer())
        .patch(`${path}/${id}`)
        .set(auth(a))
        .send({ status: 'READY' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`${path}/${id}`)
        .set(auth(a))
        .send({ status: 'SCHEDULED', scheduledAt: date })
        .expect(200);
    }
    const filteredResponse = await request(app.getHttpServer())
      .get(`${path}?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`)
      .set(auth(a))
      .expect(200);
    const filtered = ContentListResponseSchema.parse(filteredResponse.body);
    expect(filtered.items.map((item) => item.id)).toContain(inside);
    expect(filtered.items.map((item) => item.id)).not.toContain(outside);
    expect(filtered.items.map((item) => item.id)).not.toContain(noDate);
    const unscheduledResponse = await request(app.getHttpServer())
      .get(`${path}?unscheduled=true`)
      .set(auth(a))
      .expect(200);
    const unscheduled = ContentListResponseSchema.parse(
      unscheduledResponse.body,
    );
    expect(unscheduled.items.map((item) => item.id)).toContain(noDate);
    expect(unscheduled.items.map((item) => item.id)).not.toContain(inside);
    await request(app.getHttpServer())
      .get(`${path}?from=2026-10-01T00:00:00.000Z`)
      .set(auth(a))
      .expect(400);
    await request(app.getHttpServer())
      .get(`${path}?from=2026-10-01T00:00:00.000Z&to=2027-01-01T00:00:00.000Z`)
      .set(auth(a))
      .expect(400);
    await request(app.getHttpServer())
      .get(
        `${path}?unscheduled=true&from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`,
      )
      .set(auth(a))
      .expect(400);
    await request(app.getHttpServer())
      .get(`${path}?unscheduled=true`)
      .set(auth(b))
      .expect(404);
  });

  it('returns a structured 429 after the Free TEXT quota is exhausted', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { clerkId: a },
    });
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    for (let i = 0; i < 9; i++)
      await ai.reserve(
        projectId,
        owner.id,
        randomUUID(),
        { channel: 'FACEBOOK', goal: 'Test', topic: 'Quota' },
        { product: 'Test' },
        'test-model',
        10,
        start,
        end,
      );
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/generate`)
      .set(auth(a))
      .set('Idempotency-Key', randomUUID())
      .send({ channel: 'FACEBOOK', goal: 'Test', topic: 'Quota' })
      .expect(429);
    expect((response.body as { code: string }).code).toBe('QUOTA_EXCEEDED');
  });

  it('serializes quota reservations for concurrent requests by the same user', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { clerkId: b },
    });
    const project = await prisma.project.create({
      data: { ownerId: owner.id, name: 'Quota' },
    });
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const reserve = (requestId: string) =>
      ai.reserve(
        project.id,
        owner.id,
        requestId,
        { channel: 'BLOG', goal: 'Test', topic: 'Quota' },
        { product: 'Test' },
        'test-model',
        1,
        start,
        end,
      );
    const results = await Promise.allSettled([
      reserve(randomUUID()),
      reserve(randomUUID()),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.generation.count({
        where: { userId: owner.id, kind: 'TEXT' },
      }),
    ).toBe(1);
  });
});
