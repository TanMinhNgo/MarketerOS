import { randomUUID } from 'node:crypto';
import { Webhook } from 'svix';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../src/generated/prisma/client';
import { UsersRepository } from '../src/users/users.repository';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';
import {
  BrandBriefResponseSchema,
  ApiErrorSchema,
  MeResponseSchema,
  ProjectResponseSchema,
  ProjectListResponseSchema,
} from '@marketos/shared';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Core API with PostgreSQL and real guard/repositories', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let users: UsersRepository;
  let config: ConfigService;
  const a = `user_test_${randomUUID()}`;
  const b = `user_test_${randomUUID()}`;
  const profile = jest
    .fn()
    .mockResolvedValue({ name: 'Test User', email: null });
  const auth = (user: string) => ({ Authorization: `Bearer ${user}` });
  let id: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkGateway)
      .useValue({
        authenticate: (header: string) => {
          const clerkId = header.slice(7);
          if (![a, b].includes(clerkId)) throw new UnauthorizedException();
          return Promise.resolve({ clerkId, plan: 'free' });
        },
        profile,
      })
      .compile();
    prisma = module.get(PrismaService);
    users = module.get(UsersRepository);
    config = module.get(ConfigService);
    await prisma.$connect();
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { clerkId: { in: [a, b] } } });
    if (app) await app.close();
  });

  it('rejects absent/invalid tokens and creates one user under concurrent first requests', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/me')
      .set(auth('invalid'))
      .expect(401);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer()).get('/api/me').set(auth(a)).expect(200),
      ),
    );
    expect(MeResponseSchema.parse(responses[0].body).id).toBe(
      MeResponseSchema.parse(responses[1].body).id,
    );
    expect(await prisma.user.count({ where: { clerkId: a } })).toBe(1);
    const profileCalls = profile.mock.calls.length;
    await request(app.getHttpServer()).get('/api/me').set(auth(a)).expect(200);
    expect(profile.mock.calls.length).toBe(profileCalls);
  });

  it('validates input, paginates owned projects and isolates every read/write between users', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(a))
      .send({ name: 'Test', ownerId: b })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(a))
      .send({ name: '  ', color: '#bad' })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(a))
      .send({ name: '  Chiến dịch thử  ', icon: 'rocket' })
      .expect(201);
    id = ProjectResponseSchema.parse(created.body).id;
    expect(created.body).not.toHaveProperty('ownerId');
    expect(ProjectResponseSchema.parse(created.body).name).toBe(
      'Chiến dịch thử',
    );
    await request(app.getHttpServer())
      .patch(`/api/projects/${id}`)
      .set(auth(a))
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/projects?limit=101')
      .set(auth(a))
      .expect(400);
    const own = await request(app.getHttpServer())
      .get('/api/projects?page=1&limit=1')
      .set(auth(a))
      .expect(200);
    expect(ProjectListResponseSchema.parse(own.body).total).toBe(1);
    const other = await request(app.getHttpServer())
      .get('/api/projects')
      .set(auth(b))
      .expect(200);
    expect(ProjectListResponseSchema.parse(other.body).items).toHaveLength(0);
    for (const method of ['get', 'patch', 'delete', 'post'] as const) {
      const path =
        method === 'post'
          ? `/api/projects/${id}/restore`
          : `/api/projects/${id}`;
      await request(app.getHttpServer())
        [method](path)
        .set(auth(b))
        .send({ name: 'Hijack' })
        .expect(404);
    }
    await request(app.getHttpServer())
      .get(`/api/projects/${id}/brand-brief`)
      .set(auth(b))
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/projects/${id}/brand-brief`)
      .set(auth(b))
      .send({})
      .expect(404);
    const updated = await request(app.getHttpServer())
      .patch(`/api/projects/${id}`)
      .set(auth(a))
      .send({ name: 'Đã đổi tên', color: null })
      .expect(200);
    expect(ProjectResponseSchema.parse(updated.body).name).toBe('Đã đổi tên');
  });

  it('upserts one brief, blocks writes while trashed and restores without losing the brief', async () => {
    const brief = {
      product: 'Khóa học',
      audience: 'Người mới',
      tone: 'Thân thiện',
      brandColors: ['#112233'],
      visualStyle: 'Tối giản',
    };
    await request(app.getHttpServer())
      .get(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .send({ ...brief, brandColors: ['invalid'] })
      .expect(400);
    const first = await request(app.getHttpServer())
      .put(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .send(brief)
      .expect(200);
    const second = await request(app.getHttpServer())
      .put(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .send({ ...brief, tone: 'Chuyên nghiệp' })
      .expect(200);
    expect(BrandBriefResponseSchema.parse(second.body).id).toBe(
      BrandBriefResponseSchema.parse(first.body).id,
    );
    expect(await prisma.brandBrief.count({ where: { projectId: id } })).toBe(1);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { clerkId: a },
    });
    const connection = await prisma.channelConnection.create({
      data: {
        projectId: id,
        channel: 'FACEBOOK',
        externalAccountId: randomUUID(),
        displayName: 'Test account',
      },
    });
    const content = await prisma.contentItem.create({
      data: { projectId: id, channel: 'FACEBOOK', title: 'Test', body: 'Test' },
    });
    const publication = await prisma.publication.create({
      data: {
        contentId: content.id,
        connectionId: connection.id,
        requestId: randomUUID(),
        payloadSnapshot: {},
      },
    });
    await prisma.behaviorProfile.create({
      data: {
        userId: owner.id,
        windowStart: new Date(0),
        windowEnd: new Date(),
      },
    });
    await request(app.getHttpServer())
      .delete(`/api/projects/${id}`)
      .set(auth(a))
      .expect(200);
    expect(
      (
        await prisma.publication.findUniqueOrThrow({
          where: { id: publication.id },
        })
      ).status,
    ).toBe('CANCELLED');
    expect(
      await prisma.behaviorProfile.count({ where: { userId: owner.id } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/projects/${id}`)
      .set(auth(a))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/projects/${id}`)
      .set(auth(a))
      .send({ name: 'No' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .expect(404);
    await request(app.getHttpServer())
      .put(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .send(brief)
      .expect(404);
    const trash = await request(app.getHttpServer())
      .get('/api/projects/trash')
      .set(auth(a))
      .expect(200);
    expect(ProjectListResponseSchema.parse(trash.body).items[0].id).toBe(id);
    const active = await request(app.getHttpServer())
      .get('/api/projects')
      .set(auth(a))
      .expect(200);
    expect(ProjectListResponseSchema.parse(active.body).total).toBe(0);
    await request(app.getHttpServer())
      .post(`/api/projects/${id}/restore`)
      .set(auth(b))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/projects/${id}/restore`)
      .set(auth(a))
      .expect(201);
    const restored = await request(app.getHttpServer())
      .get(`/api/projects/${id}/brand-brief`)
      .set(auth(a))
      .expect(200);
    expect(BrandBriefResponseSchema.parse(restored.body).tone).toBe(
      'Chuyên nghiệp',
    );
  });

  it('returns safe 503 for a database outage on a protected endpoint', async () => {
    const spy = jest.spyOn(users, 'find').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('secret-connection-info', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );
    try {
      const result = await request(app.getHttpServer())
        .get('/api/projects')
        .set(auth(a))
        .expect(503);
      expect(result.body).toEqual({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ hiện không khả dụng.',
        details: null,
      });
      expect(JSON.stringify(result.body)).not.toContain('secret');
    } finally {
      spy.mockRestore();
    }
  });

  it('verifies raw webhook signatures, deletes only the intended user with cascade, and accepts retries', async () => {
    const secret = config.getOrThrow<string>('CLERK_WEBHOOK_SECRET');
    const webhook = new Webhook(secret);
    const signed = (body: string, timestamp = new Date()) => {
      const eventId = `msg_${randomUUID()}`;
      return {
        'svix-id': eventId,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': webhook.sign(eventId, timestamp, body),
      };
    };
    const send = (body: string, headers: Record<string, string>) =>
      request(app.getHttpServer())
        .post('/api/webhooks/clerk')
        .set('Content-Type', 'application/json')
        .set(headers)
        .send(body);
    const body = JSON.stringify(
      { type: 'user.deleted', data: { id: a } },
      null,
      2,
    );
    const headers = signed(body);
    await send(body, {}).expect(400);
    await send(body.replace(a, b), headers).expect(401);
    await send(
      body,
      signed(body, new Date(Date.now() - 10 * 60 * 1000)),
    ).expect(401);
    const malformed = JSON.stringify({ type: 'user.deleted', data: {} });
    await send(malformed, signed(malformed)).expect(400);
    expect(await prisma.user.count({ where: { clerkId: a } })).toBe(1);
    const ignored = JSON.stringify({ type: 'user.updated', data: { id: a } });
    await send(ignored, signed(ignored)).expect(200, { received: true });
    config.set('CLERK_WEBHOOK_SECRET', '');
    try {
      await send(body, headers).expect(503);
    } finally {
      config.set('CLERK_WEBHOOK_SECRET', secret);
    }
    await send(body, headers).expect(200, { received: true });
    await send(body, headers).expect(200, { received: true });
    expect(await prisma.user.count({ where: { clerkId: a } })).toBe(0);
    expect(await prisma.project.count({ where: { id } })).toBe(0);
    expect(await prisma.brandBrief.count({ where: { projectId: id } })).toBe(0);
    expect(await prisma.user.count({ where: { clerkId: b } })).toBe(1);
    let limited = false;
    for (let i = 0; i < 121; i++) {
      const response = await send(ignored, signed(ignored));
      if (response.status === 429) {
        expect(ApiErrorSchema.parse(response.body).code).toBe('RATE_LIMITED');
        limited = true;
        break;
      }
      expect(response.status).toBe(200);
    }
    expect(limited).toBe(true);
  });
});
