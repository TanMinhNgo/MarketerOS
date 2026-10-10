import { randomUUID } from 'node:crypto';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  ConnectionSchema,
  ConnectionsResponseSchema,
  OAuthStartResponseSchema,
  PublicationSchema,
  PublicationsResponseSchema,
  ProjectResponseSchema,
  IntegrationProvidersResponseSchema,
  type FeatureKey,
  type PlanKey,
} from '@marketos/shared';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import {
  ProviderError,
  ProviderGateway,
} from '../src/integrations/provider.gateway';
import { IntegrationsService } from '../src/integrations/integrations.service';
import { PublicationWorker } from '../src/integrations/publication.worker';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';
import { MediaStorage } from '../src/media/media.storage';
import { SmtpService } from '../src/integrations/smtp.service';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Phase 10 integrations', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let worker: PublicationWorker;
  const pro = `integration_pro_${randomUUID()}`;
  const other = `integration_other_${randomUUID()}`;
  const free = `integration_free_${randomUUID()}`;
  const principals: Record<string, { plan: PlanKey; features: FeatureKey[] }> =
    {
      [pro]: { plan: 'pro', features: ['channel_publishing'] },
      [other]: { plan: 'pro', features: ['channel_publishing'] },
      [free]: { plan: 'free', features: [] },
    };
  const auth = (id = pro) => ({ Authorization: `Bearer ${id}` });
  const smtp = {
    configured: () => true,
    settings: () => ({ from: 'sender@example.com' }),
    verify: jest.fn().mockResolvedValue({
      address: 'sender@example.com',
      name: 'Test sender',
    }),
    send: jest
      .fn()
      .mockResolvedValue({ id: '<message@example.com>', url: null }),
  };
  const publishProvider = jest.fn().mockImplementation((channel: string) =>
    Promise.resolve(
      channel === 'LINKEDIN'
        ? {
            id: 'urn:li:share:123',
            url: 'https://www.linkedin.com/feed/update/urn:li:share:123/',
          }
        : { id: 'page_1_123', url: 'https://www.facebook.com/page_1_123' },
    ),
  );
  let liveEntitled = true;
  const providers = {
    configured: (provider: string) => provider !== 'linkedin',
    authorize: (_provider: string, state: string) =>
      `https://provider.example/authorize?state=${encodeURIComponent(state)}`,
    exchange: () =>
      Promise.resolve({ accessToken: 'super-secret-token', expiresAt: null }),
    facebookPages: jest.fn().mockImplementation(() =>
      Promise.resolve([
        {
          id: 'page_1',
          name: 'Page One',
          avatarUrl: null,
          accessToken: 'page-secret-token',
        },
      ]),
    ),
    linkedInIdentity: () =>
      Promise.resolve({
        id: 'member_1',
        name: 'LinkedIn Member',
        avatarUrl: null,
      }),
    publish: publishProvider,
    facebookMetrics: () =>
      Promise.resolve({
        impressions: 10n,
        reach: 8n,
        clicks: null,
        likes: 2n,
        comments: 1n,
        shares: 0n,
      }),
    revoke: () => Promise.resolve(),
  };
  const clerk = {
    authenticate: (header: string) => {
      const clerkId = header.slice(7);
      if (!principals[clerkId]) throw new UnauthorizedException();
      return Promise.resolve({ clerkId, ...principals[clerkId] });
    },
    profile: () => Promise.resolve({ name: 'Integration test', email: null }),
    channelPublishingEntitled: () => Promise.resolve(liveEntitled),
    automationEntitled: () => Promise.resolve(false),
  };
  let projectId: string;
  let otherProjectId: string;
  const connectionPath = (id = projectId) => `/api/projects/${id}/connections`;
  async function connect(provider: 'facebook' | 'linkedin' = 'facebook') {
    const start = await request(app.getHttpServer())
      .post(`${connectionPath()}/${provider}/start`)
      .set(auth())
      .expect(201);
    const state = new URL(
      OAuthStartResponseSchema.parse(start.body).authUrl,
    ).searchParams.get('state');
    expect(state).toBeTruthy();
    const callback = await request(app.getHttpServer())
      .get(`/api/oauth/${provider}/callback`)
      .query({ state, code: 'test-code' })
      .expect(302);
    expect(callback.headers.location).toContain('result=connected');
    await request(app.getHttpServer())
      .get(`/api/oauth/${provider}/callback`)
      .query({ state, code: 'test-code' })
      .expect(302)
      .then((result) =>
        expect(result.headers.location).toContain('INVALID_STATE'),
      );
    const list = ConnectionsResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(connectionPath())
          .set(auth())
          .expect(200)
      ).body,
    );
    return list.items.find((item) => item.channel === provider.toUpperCase())!;
  }
  beforeAll(async () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkGateway)
      .useValue(clerk)
      .overrideProvider(ProviderGateway)
      .useValue(providers)
      .overrideProvider(SmtpService)
      .useValue(smtp)
      .compile();
    prisma = module.get(PrismaService);
    worker = new PublicationWorker(
      module.get(ConfigService),
      prisma,
      module.get(IntegrationsService),
      providers as unknown as ProviderGateway,
      clerk as unknown as ClerkGateway,
      module.get(MediaStorage),
      module.get(SmtpService),
    );
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    projectId = ProjectResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/projects')
          .set(auth())
          .send({ name: 'Integrations project' })
          .expect(201)
      ).body,
    ).id;
    otherProjectId = ProjectResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/projects')
          .set(auth(other))
          .send({ name: 'Foreign integrations project' })
          .expect(201)
      ).body,
    ).id;
  });
  afterEach(() => {
    publishProvider.mockClear();
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({
        where: { id: { in: [projectId, otherProjectId] } },
      });
      await prisma.integrationOAuthSession.deleteMany({
        where: { projectId: { in: [projectId, otherProjectId] } },
      });
      await prisma.user.deleteMany({
        where: { clerkId: { in: Object.keys(principals) } },
      });
    }
    await app?.close();
  });
  it('enforces entitlement and ownership, signs OAuth state and never exposes token', async () => {
    await request(app.getHttpServer()).get(connectionPath()).expect(401);
    expect(
      (
        await request(app.getHttpServer())
          .get(connectionPath())
          .set(auth(free))
          .expect(403)
      ).body,
    ).toMatchObject({
      code: 'PLAN_REQUIRED',
      details: { feature: 'channel_publishing' },
    });
    await request(app.getHttpServer())
      .get(connectionPath(otherProjectId))
      .set(auth())
      .expect(404);
    const connected = ConnectionSchema.parse(await connect());
    expect(connected.displayName).toBe('Page One');
    expect(JSON.stringify(connected)).not.toContain('secret');
    const credential = await prisma.integrationCredential.findUniqueOrThrow({
      where: { connectionId: connected.id },
    });
    expect(credential.ciphertext).not.toContain('page-secret-token');
    await request(app.getHttpServer())
      .post(`${connectionPath()}/facebook/start`)
      .set(auth())
      .expect(409);
    const pendingLinkedIn = OAuthStartResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${connectionPath()}/linkedin/start`)
          .set(auth())
          .expect(201)
      ).body,
    );
    liveEntitled = false;
    const rejected = await request(app.getHttpServer())
      .get('/api/oauth/linkedin/callback')
      .query({
        state: new URL(pendingLinkedIn.authUrl).searchParams.get('state'),
        code: 'test-code',
      })
      .expect(302);
    expect(rejected.headers.location).toContain('PLAN_REQUIRED');
    liveEntitled = true;
    const linkedIn = await connect('linkedin');
    expect(linkedIn.channel).toBe('LINKEDIN');
    const linkedInContent = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'LINKEDIN',
        title: 'LinkedIn approved',
        body: 'Text only',
        status: 'READY',
      },
    });
    const linkedInPublication = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(
            `/api/projects/${projectId}/contents/${linkedInContent.id}/publish`,
          )
          .set(auth())
          .set('Idempotency-Key', randomUUID())
          .expect(202)
      ).body,
    );
    await worker.execute(linkedInPublication.id);
    expect(publishProvider).toHaveBeenLastCalledWith(
      'LINKEDIN',
      'member_1',
      'super-secret-token',
      'Text only',
      [],
    );
    expect(
      (
        await prisma.publication.findUniqueOrThrow({
          where: { id: linkedInPublication.id },
        })
      ).status,
    ).toBe('PUBLISHED');
    publishProvider.mockClear();
  });

  it('publishes the provider catalog without credentials and rejects unsupported connections', async () => {
    const response = await request(app.getHttpServer())
      .get(`${connectionPath()}/providers`)
      .set(auth())
      .expect(200);
    const catalog = IntegrationProvidersResponseSchema.parse(response.body);
    expect(catalog.items.map((item) => item.provider)).toEqual([
      'facebook',
      'instagram',
      'linkedin',
      'smtp',
    ]);
    expect(
      catalog.items.find((item) => item.provider === 'linkedin')?.configured,
    ).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('secret');
    await request(app.getHttpServer())
      .get(`${connectionPath()}/providers`)
      .set(auth(free))
      .expect(403);
    await request(app.getHttpServer())
      .get(`${connectionPath()}/providers`)
      .set(auth(other))
      .expect(404);
    for (const provider of ['tiktok', 'youtube', 'email', 'blog'])
      await request(app.getHttpServer())
        .post(`${connectionPath()}/${provider}/start`)
        .set(auth())
        .expect(400);
  });

  it('connects SMTP with ownership and entitlement checks, without storing credentials', async () => {
    await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp`)
      .set(auth(free))
      .expect(403);
    await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp`)
      .set(auth(other))
      .expect(404);
    await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp/start`)
      .set(auth())
      .expect(400);
    await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp`)
      .set(auth())
      .send({ password: 'not-accepted' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post(`${connectionPath()}/smtp`)
      .set(auth())
      .expect(201);
    const connection = ConnectionSchema.parse(response.body);
    expect(connection.channel).toBe('EMAIL');
    expect(
      await prisma.integrationCredential.findUnique({
        where: { connectionId: connection.id },
      }),
    ).toBeNull();
    expect(smtp.verify).toHaveBeenCalledTimes(1);
  });

  it('freezes the email recipient, replays safely, sends once and records SMTP acceptance', async () => {
    const content = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'EMAIL',
        title: 'Tin mới',
        body: 'Xin chào!',
        status: 'READY',
      },
    });
    const path = `/api/projects/${projectId}/contents/${content.id}/publish`;
    const key = randomUUID();
    await request(app.getHttpServer())
      .post(path)
      .set(auth())
      .set('Idempotency-Key', key)
      .expect(400);
    await request(app.getHttpServer())
      .post(path)
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ email: { to: 'reader@example.com\r\nBcc: victim@example.com' } })
      .expect(400);
    const send = () =>
      request(app.getHttpServer())
        .post(path)
        .set(auth())
        .set('Idempotency-Key', key)
        .send({ email: { to: 'reader@example.com' } });
    const queued = PublicationSchema.parse((await send().expect(202)).body);
    expect(PublicationSchema.parse((await send().expect(202)).body).id).toBe(
      queued.id,
    );
    await request(app.getHttpServer())
      .post(path)
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ email: { to: 'other@example.com' } })
      .expect(409);
    await worker.execute(queued.id);
    await worker.execute(queued.id);
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(smtp.send).toHaveBeenLastCalledWith(
      {
        to: 'reader@example.com',
        from: 'sender@example.com',
        subject: 'Tin mới',
        text: 'Xin chào!',
      },
      queued.id,
      'sender@example.com',
    );
    expect(
      PublicationSchema.parse((await send().expect(202)).body).status,
    ).toBe('PUBLISHED');
    expect(
      (
        await prisma.contentItem.findUniqueOrThrow({
          where: { id: content.id },
        })
      ).status,
    ).toBe('DONE');
    expect(publishProvider).not.toHaveBeenCalled();
  });

  it('rejects unresolved email templates and does not schedule email without a recipient', async () => {
    const scheduledAt = new Date(Date.now() - 1000);
    const content = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'EMAIL',
        title: 'News',
        body: 'Footer {{unsubscribe_link}}',
        status: 'SCHEDULED',
        scheduledAt,
      },
    });
    await worker.reserveScheduled();
    expect(
      await prisma.publication.count({ where: { contentId: content.id } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contents/${content.id}/publish`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ email: { to: 'reader@example.com' } })
      .expect(400);
    await prisma.contentItem.update({
      where: { id: content.id },
      data: { title: 'News\r\nBcc: attacker@example.com', body: 'Hello' },
    });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contents/${content.id}/publish`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ email: { to: 'reader@example.com' } })
      .expect(400);
  });

  it('marks an ambiguous SMTP send failed and never resends it automatically', async () => {
    const content = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'EMAIL',
        title: 'News',
        body: 'Hello',
        status: 'READY',
      },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contents/${content.id}/publish`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ email: { to: 'reader@example.com' } })
      .expect(202);
    smtp.send.mockClear();
    const publication = PublicationSchema.parse(response.body);
    smtp.send.mockRejectedValueOnce(
      new ProviderError('PROVIDER_ERROR', false, true),
    );
    await worker.execute(publication.id);
    await worker.execute(publication.id);
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(
      await prisma.publication.findUniqueOrThrow({
        where: { id: publication.id },
      }),
    ).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      nextAttemptAt: null,
      errorCode: 'PROVIDER_ERROR',
    });
    const connection = await prisma.channelConnection.findFirstOrThrow({
      where: { projectId, channel: 'EMAIL', status: 'CONNECTED' },
    });
    await request(app.getHttpServer())
      .delete(`${connectionPath()}/${connection.id}`)
      .set(auth())
      .expect(204);
  });

  it('connects Instagram securely, requires media, and schedules image publication', async () => {
    providers.facebookPages.mockResolvedValueOnce([
      {
        id: 'ig_1',
        name: 'coffee',
        avatarUrl: null,
        accessToken: 'ig-page-secret',
      },
    ]);
    const start = OAuthStartResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${connectionPath()}/instagram/start`)
          .set(auth())
          .expect(201)
      ).body,
    );
    const state = new URL(start.authUrl).searchParams.get('state')!;
    await request(app.getHttpServer())
      .get('/api/oauth/instagram/callback')
      .query({ state, code: 'code' })
      .expect(302);
    await request(app.getHttpServer())
      .get('/api/oauth/instagram/callback')
      .query({ state, code: 'code' })
      .expect(302)
      .then((response) =>
        expect(response.headers.location).toContain('INVALID_STATE'),
      );
    const connections = ConnectionsResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(connectionPath())
          .set(auth())
          .expect(200)
      ).body,
    );
    const connection = connections.items.find(
      (item) => item.channel === 'INSTAGRAM',
    )!;
    expect(connection.displayName).toBe('coffee');
    expect(JSON.stringify(connection)).not.toContain('ig-page-secret');
    const post = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'INSTAGRAM',
        title: 'Coffee',
        body: 'Caption',
        status: 'READY',
      },
    });
    const publishPath = `/api/projects/${projectId}/contents/${post.id}/publish`;
    await request(app.getHttpServer())
      .post(publishPath)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    const image = await prisma.asset.create({
      data: {
        projectId,
        kind: 'IMAGE',
        name: 'Coffee',
        storageKey: 'ig-file',
        mimeType: 'image/png',
        byteSize: 1n,
        width: 8,
        height: 8,
      },
    });
    await prisma.contentAsset.create({
      data: { contentId: post.id, assetId: image.id, position: 0 },
    });
    jest
      .spyOn(app.get(MediaStorage), 'instagramImageUrl')
      .mockResolvedValue('https://ik.example/signed.jpg');
    const scheduledAt = new Date(Date.now() - 1000);
    await prisma.contentItem.update({
      where: { id: post.id },
      data: { status: 'SCHEDULED', scheduledAt },
    });
    await worker.reserveScheduled();
    const publication = await prisma.publication.findFirstOrThrow({
      where: { contentId: post.id },
    });
    await worker.execute(publication.id);
    expect(publishProvider).toHaveBeenLastCalledWith(
      'INSTAGRAM',
      'ig_1',
      'ig-page-secret',
      'Caption',
      [],
      ['https://ik.example/signed.jpg'],
    );
    expect(
      (
        await prisma.publication.findUniqueOrThrow({
          where: { id: publication.id },
        })
      ).status,
    ).toBe('PUBLISHED');
    const revoke = jest.spyOn(providers, 'revoke');
    await request(app.getHttpServer())
      .delete(`${connectionPath()}/${connection.id}`)
      .set(auth())
      .expect(204);
    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });

  it('keeps Instagram account selection sessions separate from Facebook', async () => {
    providers.facebookPages.mockResolvedValueOnce([
      {
        id: 'ig_a',
        name: 'first',
        avatarUrl: null,
        accessToken: 'first-secret',
      },
      {
        id: 'ig_b',
        name: 'second',
        avatarUrl: null,
        accessToken: 'second-secret',
      },
    ]);
    const start = OAuthStartResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${connectionPath()}/instagram/start`)
          .set(auth())
          .expect(201)
      ).body,
    );
    const callback = await request(app.getHttpServer())
      .get('/api/oauth/instagram/callback')
      .query({
        state: new URL(start.authUrl).searchParams.get('state'),
        code: 'code',
      })
      .expect(302);
    const url = new URL(callback.headers.location);
    expect(url.searchParams.get('provider')).toBe('instagram');
    const session = url.searchParams.get('session')!;
    await request(app.getHttpServer())
      .get(`${connectionPath()}/facebook/pages`)
      .query({ session })
      .set(auth())
      .expect(404);
    const accounts = await request(app.getHttpServer())
      .get(`${connectionPath()}/instagram/accounts`)
      .query({ session })
      .set(auth())
      .expect(200);
    expect(JSON.stringify(accounts.body)).not.toContain('secret');
    await request(app.getHttpServer())
      .post(`${connectionPath()}/instagram/accounts`)
      .set(auth())
      .send({ session, pageId: 'foreign' })
      .expect(400);
    const selected = await request(app.getHttpServer())
      .post(`${connectionPath()}/instagram/accounts`)
      .set(auth())
      .send({ session, pageId: 'ig_b' })
      .expect(201);
    expect(ConnectionSchema.parse(selected.body).channel).toBe('INSTAGRAM');
    await request(app.getHttpServer())
      .post(`${connectionPath()}/instagram/accounts`)
      .set(auth())
      .send({ session, pageId: 'ig_b' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${connectionPath()}/${ConnectionSchema.parse(selected.body).id}`)
      .set(auth())
      .expect(204);
  });
  it('rejects drafts, publishes approved content once and preserves history after disconnect', async () => {
    const connection = await prisma.channelConnection.findFirstOrThrow({
      where: { projectId, channel: 'FACEBOOK' },
    });
    const draft = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Draft',
        body: 'Must never publish',
        status: 'DRAFT',
      },
    });
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contents/${draft.id}/publish`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    const ready = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Approved',
        body: 'Ready content',
        status: 'READY',
      },
    });
    const key = randomUUID();
    const path = `/api/projects/${projectId}/contents/${ready.id}/publish`;
    const first = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .set('Idempotency-Key', key)
          .expect(202)
      ).body,
    );
    const replay = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .set('Idempotency-Key', key)
          .expect(202)
      ).body,
    );
    expect(first.id).toBe(replay.id);
    await worker.execute(first.id);
    const afterPublishReplay = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .set('Idempotency-Key', key)
          .expect(202)
      ).body,
    );
    expect(afterPublishReplay.id).toBe(first.id);
    expect(publishProvider).toHaveBeenCalledTimes(1);
    expect(
      (await prisma.contentItem.findUniqueOrThrow({ where: { id: ready.id } }))
        .status,
    ).toBe('DONE');
    expect(
      (await prisma.contentItem.findUniqueOrThrow({ where: { id: draft.id } }))
        .status,
    ).toBe('DRAFT');
    const downgraded = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Downgraded',
        body: 'Do not publish',
        status: 'READY',
      },
    });
    const queued = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`/api/projects/${projectId}/contents/${downgraded.id}/publish`)
          .set(auth())
          .set('Idempotency-Key', randomUUID())
          .expect(202)
      ).body,
    );
    liveEntitled = false;
    await worker.execute(queued.id);
    expect(
      (await prisma.publication.findUniqueOrThrow({ where: { id: queued.id } }))
        .errorCode,
    ).toBe('PERMISSION_DENIED');
    expect(publishProvider).toHaveBeenCalledTimes(1);
    liveEntitled = true;
    const published = PublicationsResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`/api/projects/${projectId}/publications`)
          .set(auth())
          .expect(200)
      ).body,
    );
    expect(published.items.find((item) => item.id === first.id)?.status).toBe(
      'PUBLISHED',
    );
    await request(app.getHttpServer())
      .delete(`${connectionPath()}/${connection.id}`)
      .set(auth())
      .expect(204);
    expect(
      (await prisma.publication.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
    ).toBe('PUBLISHED');
    expect(
      await prisma.integrationCredential.findUnique({
        where: { connectionId: connection.id },
      }),
    ).toBeNull();
  });

  it('selects one of multiple Pages, handles token expiry and schedules only due approved content', async () => {
    providers.facebookPages.mockResolvedValueOnce([
      {
        id: 'page_2',
        name: 'Page Two',
        avatarUrl: null,
        accessToken: 'page-two-secret',
      },
      {
        id: 'page_3',
        name: 'Page Three',
        avatarUrl: null,
        accessToken: 'page-three-secret',
      },
    ]);
    const start = OAuthStartResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${connectionPath()}/facebook/start`)
          .set(auth())
          .expect(201)
      ).body,
    );
    const state = new URL(start.authUrl).searchParams.get('state');
    const callback = await request(app.getHttpServer())
      .get('/api/oauth/facebook/callback')
      .query({ state, code: 'test-code' })
      .expect(302);
    const redirect = new URL(callback.headers.location);
    expect(redirect.searchParams.get('result')).toBe('pick');
    const session = redirect.searchParams.get('session')!;
    const pages = (
      await request(app.getHttpServer())
        .get(`${connectionPath()}/facebook/pages`)
        .set(auth())
        .query({ session })
        .expect(200)
    ).body as { items: { id: string }[] };
    expect(pages.items.map((page) => page.id)).toEqual(['page_2', 'page_3']);
    expect(JSON.stringify(pages)).not.toContain('secret');
    const selected = ConnectionSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${connectionPath()}/facebook/pages`)
          .set(auth())
          .send({ session, pageId: 'page_3' })
          .expect(201)
      ).body,
    );
    await request(app.getHttpServer())
      .post(`${connectionPath()}/facebook/pages`)
      .set(auth())
      .send({ session, pageId: 'page_2' })
      .expect(404);
    const due = new Date(Date.now() - 60_000);
    const scheduled = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Due',
        body: 'Approved due content',
        status: 'SCHEDULED',
        scheduledAt: due,
      },
    });
    await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Draft due',
        body: 'Never post',
        status: 'DRAFT',
        scheduledAt: due,
      },
    });
    await worker.reserveScheduled();
    await worker.reserveScheduled();
    const rows = await prisma.publication.findMany({
      where: { contentId: scheduled.id },
    });
    expect(rows).toHaveLength(1);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/contents/${scheduled.id}/publish`)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    await worker.execute(rows[0].id);
    expect(
      (
        await prisma.publication.findUniqueOrThrow({
          where: { id: rows[0].id },
        })
      ).status,
    ).toBe('PUBLISHED');
    expect(
      await prisma.publication.count({
        where: { content: { title: 'Draft due' } },
      }),
    ).toBe(0);
    await worker.syncMetrics();
    const metric = await prisma.publicationMetric.findFirst({
      where: { publicationId: rows[0].id },
    });
    expect(metric?.impressions).toBe(10n);
    const rateLimited = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Rate limited',
        body: 'Approved',
        status: 'READY',
      },
    });
    const limited = PublicationSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`/api/projects/${projectId}/contents/${rateLimited.id}/publish`)
          .set(auth())
          .set('Idempotency-Key', randomUUID())
          .expect(202)
      ).body,
    );
    publishProvider
      .mockRejectedValueOnce(new ProviderError('RATE_LIMITED', true))
      .mockRejectedValueOnce(new ProviderError('RATE_LIMITED', true))
      .mockRejectedValueOnce(new ProviderError('RATE_LIMITED', true));
    for (let attempt = 1; attempt <= 3; attempt++) {
      await worker.execute(limited.id); // NOSONAR: each attempt follows the previous persisted retry state.
      const current = await prisma.publication.findUniqueOrThrow({
        where: { id: limited.id },
      }); // NOSONAR: assert this attempt before the next one.
      expect(current.attempts).toBe(attempt);
      expect(current.status).toBe(attempt < 3 ? 'QUEUED' : 'FAILED');
      if (attempt < 3)
        await prisma.publication.update({
          where: { id: limited.id },
          data: { nextAttemptAt: new Date(Date.now() - 1000) },
        }); // NOSONAR: simulate retry delay elapsed before re-executing.
    }
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/publications/${rows[0].id}/metrics`)
      .set(auth())
      .send({ impressions: '999' })
      .expect(404);
    await prisma.channelConnection.update({
      where: { id: selected.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredContent = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Expired token',
        body: 'Do not publish',
        status: 'READY',
      },
    });
    const expiredJob = await prisma.publication.create({
      data: {
        contentId: expiredContent.id,
        connectionId: selected.id,
        requestId: randomUUID(),
        payloadSnapshot: { title: 'Expired token', body: 'Do not publish' },
        status: 'QUEUED',
      },
    });
    await worker.execute(expiredJob.id);
    expect(
      (
        await prisma.publication.findUniqueOrThrow({
          where: { id: expiredJob.id },
        })
      ).errorCode,
    ).toBe('TOKEN_EXPIRED');
    const listing = ConnectionsResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(connectionPath())
          .set(auth())
          .expect(200)
      ).body,
    );
    expect(listing.items.find((item) => item.id === selected.id)?.status).toBe(
      'EXPIRED',
    );
    await prisma.project.delete({ where: { id: projectId } });
    expect(
      await prisma.integrationOAuthSession.count({ where: { projectId } }),
    ).toBe(0);
    expect(
      await prisma.publication.findUnique({ where: { id: rows[0].id } }),
    ).toBeNull();
    expect(
      await prisma.publicationMetric.findFirst({
        where: { publicationId: rows[0].id },
      }),
    ).toBeNull();
  });
});
