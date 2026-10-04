import { randomUUID } from 'node:crypto';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import sharp from 'sharp';
import {
  ApiErrorSchema,
  AssetSchema,
  AssetListResponseSchema,
  AssetUrlResponseSchema,
  BillingUsageResponseSchema,
  ContentAssetsResponseSchema,
  ProjectResponseSchema,
  type FeatureKey,
  type PlanKey,
} from '@marketos/shared';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import { ImageProvider } from '../src/media/image-provider';
import { MediaStorage } from '../src/media/media.storage';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Phase 11 media API', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const owner = `media_owner_${randomUUID()}`;
  const other = `media_other_${randomUUID()}`;
  const withoutFeature = `media_without_${randomUUID()}`;
  const principals: Record<string, { plan: PlanKey; features: FeatureKey[] }> =
    {
      [owner]: { plan: 'free', features: ['image_generation'] },
      [other]: { plan: 'free', features: ['image_generation'] },
      [withoutFeature]: { plan: 'free', features: [] },
    };
  const auth = (id = owner) => ({ Authorization: `Bearer ${id}` });
  const image = jest.fn<Promise<Uint8Array>, [string, string, string]>();
  const uploadedFileIds: string[] = [];
  const storage = {
    put: jest.fn().mockImplementation(() => {
      const fileId = randomUUID();
      uploadedFileIds.push(fileId);
      return Promise.resolve(fileId);
    }),
    remove: jest.fn().mockResolvedValue(undefined),
    url: jest.fn().mockResolvedValue({
      url: 'https://media.example/signed',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }),
  };
  let projectId: string;
  let otherProjectId: string;
  const assets = (id = projectId) => `/api/projects/${id}/assets`;

  beforeAll(async () => {
    const bytes = await sharp({
      create: { width: 16, height: 16, channels: 4, background: '#123456' },
    })
      .png()
      .toBuffer();
    image.mockResolvedValue(bytes);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ClerkGateway)
      .useValue({
        authenticate: (header: string) => {
          const clerkId = header.slice(7);
          if (!principals[clerkId]) throw new UnauthorizedException();
          return Promise.resolve({ clerkId, ...principals[clerkId] });
        },
        profile: () => Promise.resolve({ name: 'Media test', email: null }),
      })
      .overrideProvider(ImageProvider)
      .useValue({ generate: image })
      .overrideProvider(MediaStorage)
      .useValue(storage)
      .compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    projectId = ProjectResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/projects')
          .set(auth())
          .send({ name: 'Media project' })
          .expect(201)
      ).body,
    ).id;
    otherProjectId = ProjectResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/api/projects')
          .set(auth(other))
          .send({ name: 'Other project' })
          .expect(201)
      ).body,
    ).id;
    await prisma.brandBrief.create({
      data: {
        projectId,
        product: 'Coffee',
        audience: 'Adults',
        tone: 'Warm',
        visualStyle: 'Natural light',
      },
    });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({
      where: { clerkId: { in: Object.keys(principals) } },
    });
    await prisma?.mediaDeletion.deleteMany({
      where: {
        storageKey: { in: uploadedFileIds },
      },
    });
    await app?.close();
  });

  it('enforces entitlement and ownership without calling image model', async () => {
    await request(app.getHttpServer())
      .get(assets())
      .set(auth(withoutFeature))
      .expect(403);
    await request(app.getHttpServer())
      .get(assets(otherProjectId))
      .set(auth())
      .expect(404);
    expect(image).not.toHaveBeenCalled();
  });

  it('rejects invalid and oversized image uploads before writing storage', async () => {
    await request(app.getHttpServer())
      .post(`${assets()}/upload`)
      .set(auth())
      .attach('file', Buffer.from('not-image'), 'bad.png')
      .expect(400);
    const oversized = await request(app.getHttpServer())
      .post(`${assets()}/upload`)
      .set(auth())
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'big.png');
    expect(oversized.status).toBe(413);
    expect(ApiErrorSchema.parse(oversized.body).code).toBe('VALIDATION');
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('uploads, signs reads, attaches only same-project assets and hides storage key', async () => {
    const file = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#abcdef' },
    })
      .jpeg()
      .toBuffer();
    const asset = AssetSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${assets()}/upload`)
          .set(auth())
          .attach('file', file, 'picture.jpg')
          .expect(201)
      ).body,
    );
    expect(JSON.stringify(asset)).not.toContain('storageKey');
    expect(
      AssetUrlResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(`${assets()}/${asset.id}/url`)
            .set(auth())
            .expect(200)
        ).body,
      ).url,
    ).toContain('https://media.example/');
    await request(app.getHttpServer())
      .get(`${assets(otherProjectId)}/${asset.id}`)
      .set(auth(other))
      .expect(404);
    const content = await prisma.contentItem.create({
      data: {
        projectId,
        channel: 'FACEBOOK',
        title: 'Post',
        body: 'Body',
        status: 'DRAFT',
      },
    });
    await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/contents/${content.id}/assets`)
      .set(auth())
      .send({ assetIds: [asset.id] })
      .expect(200);
    const links = ContentAssetsResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`/api/projects/${projectId}/contents/${content.id}/assets`)
          .set(auth())
          .expect(200)
      ).body,
    );
    expect(links.items).toHaveLength(1);
    const otherContent = await prisma.contentItem.create({
      data: {
        projectId: otherProjectId,
        channel: 'FACEBOOK',
        title: 'Other',
        body: 'Body',
        status: 'DRAFT',
      },
    });
    await request(app.getHttpServer())
      .put(`/api/projects/${otherProjectId}/contents/${otherContent.id}/assets`)
      .set(auth(other))
      .send({ assetIds: [asset.id] })
      .expect(404);
    await request(app.getHttpServer())
      .get(assets())
      .set(auth())
      .query({ before: 'foreign-cursor' })
      .expect(404);
    await prisma.contentItem.update({
      where: { id: content.id },
      data: { status: 'READY' },
    });
    await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/contents/${content.id}/assets`)
      .set(auth())
      .send({ assetIds: [asset.id] })
      .expect(200);
    expect(
      (
        await prisma.contentItem.findUniqueOrThrow({
          where: { id: content.id },
        })
      ).status,
    ).toBe('READY');
    await request(app.getHttpServer())
      .delete(`${assets()}/${asset.id}`)
      .set(auth())
      .expect(409);
    await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/contents/${content.id}/assets`)
      .set(auth())
      .send({ assetIds: [] })
      .expect(200);
    expect(
      (
        await prisma.contentItem.findUniqueOrThrow({
          where: { id: content.id },
        })
      ).status,
    ).toBe('DRAFT');
    await request(app.getHttpServer())
      .delete(`${assets()}/${asset.id}`)
      .set(auth())
      .expect(204);
    expect(
      await prisma.mediaDeletion.count({
        where: { storageKey: { in: uploadedFileIds } },
      }),
    ).toBe(1);
  });

  it('counts every IMAGE reservation, rejects duplicate key and sixth Free run', async () => {
    const path = `/api/projects/${projectId}/images/generate`;
    const key = randomUUID();
    const first = AssetSchema.parse(
      (
        await request(app.getHttpServer())
          .post(path)
          .set(auth())
          .set('Idempotency-Key', key)
          .send({ prompt: 'Coffee campaign' })
          .expect(201)
      ).body,
    );
    expect(first.generationId).toBeTruthy();
    await request(app.getHttpServer())
      .post(path)
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ prompt: 'Coffee campaign' })
      .expect(409);
    for (let index = 0; index < 4; index++) {
      await request(app.getHttpServer())
        .post(path)
        .set(auth())
        .set('Idempotency-Key', randomUUID())
        .send({ prompt: 'Coffee campaign' })
        .expect(201);
    }
    const usage = BillingUsageResponseSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/billing/usage')
          .set(auth())
          .expect(200)
      ).body,
    );
    expect(usage.usage.images).toEqual({ used: 5, limit: 5 });
    const denied = await request(app.getHttpServer())
      .post(path)
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'Coffee campaign' })
      .expect(429);
    expect(ApiErrorSchema.parse(denied.body).code).toBe('QUOTA_EXCEEDED');
    expect(image).toHaveBeenCalledTimes(5);
    const list = AssetListResponseSchema.parse(
      (await request(app.getHttpServer()).get(assets()).set(auth()).expect(200))
        .body,
    );
    expect(list.items.some((item) => item.id === first.id)).toBe(true);
  });

  it('queues object deletion when project rows cascade', async () => {
    const file = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#abcdef' },
    })
      .png()
      .toBuffer();
    await request(app.getHttpServer())
      .post(`${assets(otherProjectId)}/upload`)
      .set(auth(other))
      .attach('file', file, 'cascade.png')
      .expect(201);
    await prisma.project.update({
      where: { id: otherProjectId },
      data: { deletedAt: new Date() },
    });
    await request(app.getHttpServer())
      .get(assets(otherProjectId))
      .set(auth(other))
      .expect(404);
    await prisma.project.delete({ where: { id: otherProjectId } });
    expect(
      await prisma.mediaDeletion.count({
        where: { storageKey: { in: uploadedFileIds } },
      }),
    ).toBe(2);
  });
});
