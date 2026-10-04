import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  BillingUsageResponseSchema,
  ApiErrorSchema,
  MeResponseSchema,
  ProjectResponseSchema,
  PlanLimitDetailsSchema,
  type PlanKey,
} from '@marketos/shared';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';
import { QuotaService } from '../src/ai/quota.service';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Billing limits with PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const free = `billing_${randomUUID()}`;
  const pro = `billing_${randomUUID()}`;
  const plans: Record<string, PlanKey> = { [free]: 'free', [pro]: 'pro' };
  const ids: Record<string, string> = {};
  const auth = (clerkId: string) => ({ Authorization: `Bearer ${clerkId}` });
  const create = (clerkId: string) =>
    request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(clerkId))
      .send({ name: 'Billing test' });
  let freeProject: string;
  let proProject: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkGateway)
      .useValue({
        authenticate: (header: string) => {
          const clerkId = header.slice(7);
          if (!plans[clerkId]) throw new UnauthorizedException();
          return Promise.resolve({
            clerkId,
            plan: plans[clerkId],
            features: clerkId === free ? ['brand_brief'] : [],
          });
        },
        profile: () => Promise.resolve({ name: 'Billing test', email: null }),
      })
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    for (const clerkId of [free, pro]) {
      const response = await request(app.getHttpServer())
        .get('/api/me')
        .set(auth(clerkId))
        .expect(200);
      ids[clerkId] = MeResponseSchema.parse(response.body).id;
    }
  });
  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { clerkId: { in: [free, pro] } } });
    if (app) await app.close();
  });

  it('Free has 3 active slots, concurrent creates cannot take the last slot twice', async () => {
    freeProject = ProjectResponseSchema.parse(
      (await create(free).expect(201)).body,
    ).id;
    await create(free).expect(201);
    const responses = await Promise.all([create(free), create(free)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 403]);
    const rejected = await create(free).expect(403);
    const error = ApiErrorSchema.parse(rejected.body);
    expect(error.code).toBe('PLAN_LIMIT');
    expect(PlanLimitDetailsSchema.parse(error.details)).toEqual({
      limit: 3,
      used: 3,
      plan: 'free',
    });
    expect(
      await prisma.project.count({
        where: { ownerId: ids[free], deletedAt: null },
      }),
    ).toBe(3);
  });

  it('Trash does not count, restore enforces limits and ownership; create/restore share the lock', async () => {
    await request(app.getHttpServer())
      .delete(`/api/projects/${freeProject}`)
      .set(auth(free))
      .expect(200);
    await create(free).expect(201);
    const rejected = await request(app.getHttpServer())
      .post(`/api/projects/${freeProject}/restore`)
      .set(auth(free))
      .expect(403);
    expect(rejected.body).toMatchObject({
      code: 'PLAN_LIMIT',
      details: { limit: 3, used: 3, plan: 'free' },
    });
    await request(app.getHttpServer())
      .post(`/api/projects/${freeProject}/restore`)
      .set(auth(pro))
      .expect(404);
    const active = await prisma.project.findFirstOrThrow({
      where: { ownerId: ids[free], deletedAt: null },
    });
    await request(app.getHttpServer())
      .delete(`/api/projects/${active.id}`)
      .set(auth(free))
      .expect(200);
    const responses = await Promise.all([
      create(free),
      request(app.getHttpServer())
        .post(`/api/projects/${freeProject}/restore`)
        .set(auth(free)),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 403]);
    expect(
      await prisma.project.count({
        where: { ownerId: ids[free], deletedAt: null },
      }),
    ).toBe(3);
  });

  it('Pro allows 20, blocks 21; downgrade retains access but blocks new/restore', async () => {
    for (let i = 0; i < 20; i++) {
      const response = await create(pro).expect(201);
      proProject = ProjectResponseSchema.parse(response.body).id;
    }
    const rejected = await create(pro).expect(403);
    expect(rejected.body).toMatchObject({
      code: 'PLAN_LIMIT',
      details: { limit: 20, used: 20, plan: 'pro' },
    });
    plans[pro] = 'free';
    await request(app.getHttpServer())
      .get(`/api/projects/${proProject}`)
      .set(auth(pro))
      .expect(200);
    await create(pro).expect(403);
    await request(app.getHttpServer())
      .delete(`/api/projects/${proProject}`)
      .set(auth(pro))
      .expect(200);
    const restore = await request(app.getHttpServer())
      .post(`/api/projects/${proProject}/restore`)
      .set(auth(pro))
      .expect(403);
    expect(ApiErrorSchema.parse(restore.body).details).toEqual({
      limit: 3,
      used: 19,
      plan: 'free',
    });
    const usage = await request(app.getHttpServer())
      .get('/api/billing/usage')
      .set(auth(pro))
      .expect(200);
    expect(BillingUsageResponseSchema.parse(usage.body).usage.projects).toEqual(
      { used: 19, limit: 3 },
    );
    plans[pro] = 'pro';
    await request(app.getHttpServer())
      .post(`/api/projects/${proProject}/restore`)
      .set(auth(pro))
      .expect(201);
  });

  it('usage counts all TEXT statuses and rounded regenerations for only the authenticated user/month', async () => {
    const { start, end } = new QuotaService().period();
    const active = await prisma.project.findFirstOrThrow({
      where: { ownerId: ids[free], deletedAt: null },
    });
    const base = {
      userId: ids[free],
      projectId: active.id,
      input: {},
      briefSnapshot: {},
      model: 'test',
      createdAt: start,
    };
    await prisma.generation.createMany({
      data: [
        ...[0, 1].map(() => ({
          ...base,
          requestId: randomUUID(),
          kind: 'TEXT' as const,
          requestedOutputs: 3,
          quotaUnits: 1,
        })),
        ...(['PENDING', 'FAILED', 'CANCELLED', 'SUCCEEDED'] as const).map(
          (status) => ({
            ...base,
            requestId: randomUUID(),
            kind: 'TEXT' as const,
            requestedOutputs: 1,
            quotaUnits: 0,
            status,
            completedAt: status === 'PENDING' ? null : start,
            completedOutputs: status === 'SUCCEEDED' ? 1 : 0,
          }),
        ),
        {
          ...base,
          requestId: randomUUID(),
          kind: 'TEXT',
          requestedOutputs: 3,
          quotaUnits: 5,
          createdAt: new Date(start.getTime() - 1),
        },
        {
          ...base,
          requestId: randomUUID(),
          kind: 'TEXT',
          requestedOutputs: 3,
          quotaUnits: 5,
          createdAt: end,
        },
        {
          ...base,
          requestId: randomUUID(),
          kind: 'IMAGE',
          requestedOutputs: 1,
          quotaUnits: 7,
        },
        {
          ...base,
          userId: ids[pro],
          projectId: proProject,
          requestId: randomUUID(),
          kind: 'TEXT',
          requestedOutputs: 3,
          quotaUnits: 37,
        },
      ],
    });
    // Trashing a project does not release its generations' quota.
    await request(app.getHttpServer())
      .delete(`/api/projects/${active.id}`)
      .set(auth(free))
      .expect(200);
    await request(app.getHttpServer()).get('/api/billing/usage').expect(401);
    await request(app.getHttpServer())
      .get('/api/billing/usage')
      .set(auth('invalid'))
      .expect(401);
    const response = await request(app.getHttpServer())
      .get(`/api/billing/usage?userId=${ids[pro]}`)
      .set(auth(free))
      .expect(200);
    expect(BillingUsageResponseSchema.parse(response.body)).toEqual({
      plan: 'free',
      features: ['brand_brief'],
      period: { start: start.toISOString(), end: end.toISOString() },
      usage: {
        projects: { used: 2, limit: 3 },
        text: { used: 4, limit: 10 },
        images: { used: 1, limit: 5 },
      },
    });
    const other = await request(app.getHttpServer())
      .get('/api/billing/usage')
      .set(auth(pro))
      .expect(200);
    expect(BillingUsageResponseSchema.parse(other.body)).toMatchObject({
      plan: 'pro',
      features: [],
      usage: {
        projects: { used: 20, limit: 20 },
        text: { used: 37, limit: 200 },
      },
    });
  });

  it('Swagger describes usage auth/schema and project PLAN_LIMIT responses', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(document.paths['/api/billing/usage'].get?.security).toEqual([
      { bearer: [] },
    ]);
    expect(
      document.paths['/api/billing/usage'].get?.responses['200'],
    ).toBeDefined();
    for (const path of ['/api/projects', '/api/projects/{projectId}/restore']) {
      expect(document.paths[path].post?.responses['403']).toMatchObject({
        description: expect.stringContaining('PLAN_LIMIT') as unknown,
      });
    }
  });
});
