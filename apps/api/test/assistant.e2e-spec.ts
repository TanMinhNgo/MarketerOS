import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  AssistantDoneSchema,
  AssistantMessageSchema,
  AssistantMessagesResponseSchema,
  BillingUsageResponseSchema,
  MeResponseSchema,
  ProjectResponseSchema,
  type AssistantDone,
  type PlanKey,
} from '@marketos/shared';
import { AppModule } from '../src/app.module';
import { ClerkGateway } from '../src/auth/clerk.gateway';
import { OpenAiService } from '../src/ai/openai.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { QuotaService } from '../src/ai/quota.service';
import { configureApp } from '../src/common/configure-app';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite(
  'Assistant API with PostgreSQL, real guards/reservation and mocked providers',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    const free = `assistant_free_${randomUUID()}`;
    const pro = `assistant_pro_${randomUUID()}`;
    const other = `assistant_other_${randomUUID()}`;
    const noFeature = `assistant_no_feature_${randomUUID()}`;
    const principals: Record<string, { plan: PlanKey; features: string[] }> = {
      [free]: { plan: 'free', features: [] },
      [pro]: { plan: 'pro', features: ['ai_assistant'] },
      [other]: { plan: 'pro', features: ['ai_assistant'] },
      [noFeature]: { plan: 'pro', features: [] },
    };
    const auth = (id = pro) => ({ Authorization: `Bearer ${id}` });
    const ids: Record<string, string> = {};
    const mediaStorageKeys: string[] = [];
    let project: string;
    let second: string;
    let foreign: string;
    let freeProject: string;
    let readyId: string;
    let draftId: string;
    let doneId: string;
    let lastDone: AssistantDone;
    const path = (id = project) => `/api/projects/${id}/assistant/messages`;
    const send = (id = project, key: string = randomUUID()) =>
      request(app.getHttpServer())
        .post(path(id))
        .set(auth())
        .set('Idempotency-Key', key)
        .send({ content: 'Đề xuất giúp tôi lên lịch bài viết.' });
    const done = (text: string) =>
      AssistantDoneSchema.parse(
        JSON.parse(/event: done\ndata: ([^\n]+)/.exec(text)![1]),
      );
    const reply = () => ({
      text: 'Đây là các đề xuất, chưa có hành động nào được thực thi.',
      validationNote:
        'Một số đề xuất chưa hợp lệ nên chưa có thẻ action; hãy yêu cầu lại.',
      actions: [
        {
          type: 'update_brief',
          changes: [{ field: 'tone', value: 'Giọng mới' }],
        },
        {
          type: 'schedule',
          contentId: readyId,
          scheduledAt: '2026-12-01T08:00:00Z',
        },
        {
          type: 'schedule',
          contentId: draftId,
          scheduledAt: '2026-12-01T08:00:00Z',
        },
        {
          type: 'edit_content',
          contentId: doneId,
          changes: [{ field: 'title', value: 'Không được sửa' }],
          assetIds: null,
          assetMode: null,
          imagePrompt: null,
        },
        {
          type: 'schedule',
          contentId: 'foreign-content',
          scheduledAt: '2026-12-01T08:00:00Z',
        },
      ],
    });
    const provider = jest.fn().mockImplementation(() => {
      const output = reply();
      return {
        partialOutputStream: (async function* () {
          await Promise.resolve();
          yield { text: output.text.slice(0, 10) };
          yield output;
        })(),
        output: Promise.resolve(output),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ inputTokens: 50, outputTokens: 30 }),
      };
    });

    beforeAll(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ClerkGateway)
        .useValue({
          authenticate: (header: string) => {
            const clerkId = header.slice(7);
            if (!principals[clerkId]) throw new UnauthorizedException();
            return Promise.resolve({ clerkId, ...principals[clerkId] });
          },
          profile: () =>
            Promise.resolve({ name: 'Assistant test', email: null }),
        })
        .overrideProvider(OpenAiService)
        .useValue({ assistant: provider })
        .compile();
      prisma = module.get(PrismaService);
      app = module.createNestApplication();
      configureApp(app);
      await app.init();
      for (const clerkId of Object.keys(principals))
        ids[clerkId] = MeResponseSchema.parse(
          (
            await request(app.getHttpServer())
              .get('/api/me')
              .set(auth(clerkId))
              .expect(200)
          ).body,
        ).id;
      const create = async (clerkId: string) =>
        ProjectResponseSchema.parse(
          (
            await request(app.getHttpServer())
              .post('/api/projects')
              .set(auth(clerkId))
              .send({ name: 'Assistant test' })
              .expect(201)
          ).body,
        ).id;
      project = await create(pro);
      second = await create(pro);
      foreign = await create(other);
      freeProject = await create(free);
      for (const [id, owner] of [
        [project, pro],
        [second, pro],
        [foreign, other],
      ])
        await request(app.getHttpServer())
          .put(`/api/projects/${id}/brand-brief`)
          .set(auth(owner))
          .send({
            product: 'Khóa học',
            audience: 'Người mới',
            tone: 'Thân thiện',
          })
          .expect(200);
      readyId = (
        await prisma.contentItem.create({
          data: {
            projectId: project,
            channel: 'FACEBOOK',
            title: 'Ready',
            body: 'Bài đã duyệt',
            status: 'READY',
          },
        })
      ).id;
      draftId = (
        await prisma.contentItem.create({
          data: {
            projectId: project,
            channel: 'FACEBOOK',
            title: 'Draft',
            body: 'Bài chưa duyệt',
          },
        })
      ).id;
      doneId = (
        await prisma.contentItem.create({
          data: {
            projectId: project,
            channel: 'FACEBOOK',
            title: 'Done',
            body: 'Bài hoàn tất',
            status: 'DONE',
            scheduledAt: new Date(),
          },
        })
      ).id;
    });
    afterAll(async () => {
      if (prisma)
        await prisma.user.deleteMany({
          where: { clerkId: { in: Object.keys(principals) } },
        });
      if (prisma)
        await prisma.mediaDeletion.deleteMany({
          where: { storageKey: { in: mediaStorageKeys } },
        });
      if (app) await app.close();
    });

    it('every route requires Pro entitlement, ownership and active project; validates input/key', async () => {
      for (const method of ['get', 'post', 'delete', 'patch'] as const) {
        const suffix = method === 'patch' ? '/missing/actions/missing' : '';
        for (const user of [free, noFeature]) {
          const response = await request(app.getHttpServer())
            [method](path(freeProject) + suffix)
            .set(auth(user))
            .send(
              method === 'patch' ? { status: 'dismissed' } : { content: 'Hi' },
            )
            .expect(403);
          expect(response.body).toMatchObject({
            code: 'PLAN_REQUIRED',
            details: { feature: 'ai_assistant' },
          });
        }
        await request(app.getHttpServer())
          [method](path(foreign) + suffix)
          .set(auth())
          .send({ content: 'Hi', status: 'dismissed' })
          .expect(404);
      }
      await request(app.getHttpServer()).get(path()).expect(401);
      for (const key of [undefined, 'invalid']) {
        const req = request(app.getHttpServer())
          .post(path())
          .set(auth())
          .send({ content: 'Hi' });
        if (key) req.set('Idempotency-Key', key);
        await req.expect(400);
      }
      for (const body of [
        { content: '' },
        { content: 'x'.repeat(4001) },
        { content: 'Hi', userId: ids[other] },
      ])
        await request(app.getHttpServer())
          .post(path())
          .set(auth())
          .set('Idempotency-Key', randomUUID())
          .send(body)
          .expect(400);
      await request(app.getHttpServer())
        .get(path() + '?limit=101')
        .set(auth())
        .expect(400);
      await request(app.getHttpServer())
        .delete(`/api/projects/${second}`)
        .set(auth())
        .expect(200);
      await send(second).expect(404);
      await request(app.getHttpServer())
        .get(path(second))
        .set(auth())
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/projects/${second}/restore`)
        .set(auth())
        .expect(201);
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'ASSISTANT' },
        }),
      ).toBe(0);
    });

    it('streams append-only text, stores proposed actions/token usage but executes nothing; duplicate IDs conflict', async () => {
      const key = randomUUID();
      const response = await send(project, key).expect(200);
      lastDone = done(response.text);
      const deltas = [
        ...response.text.matchAll(/event: message.delta\ndata: ([^\n]+)/g),
      ]
        .map((match) => (JSON.parse(match[1]) as { text: string }).text)
        .join('');
      expect(deltas).toBe(lastDone.assistantMessage.content);
      expect(lastDone.assistantMessage.actions.map((a) => a.type)).toEqual([
        'update_brief',
        'schedule',
      ]);
      expect(
        lastDone.assistantMessage.actions.every((a) => a.status === 'proposed'),
      ).toBe(true);
      expect(
        await prisma.contentItem.count({ where: { projectId: project } }),
      ).toBe(3);
      expect(
        (await prisma.contentItem.findUniqueOrThrow({ where: { id: readyId } }))
          .status,
      ).toBe('READY');
      expect(
        (
          await prisma.brandBrief.findUniqueOrThrow({
            where: { projectId: project },
          })
        ).tone,
      ).toBe('Thân thiện');
      const gen = await prisma.generation.findUniqueOrThrow({
        where: { userId_requestId: { userId: ids[pro], requestId: key } },
      });
      expect(gen).toMatchObject({
        kind: 'ASSISTANT',
        status: 'SUCCEEDED',
        requestedOutputs: 1,
        completedOutputs: 1,
        quotaUnits: 1,
        tokensIn: 50,
        tokensOut: 30,
        input: {},
        briefSnapshot: {},
      });
      await send(project, key).expect(409);
      await send(second, key).expect(409);
    });

    it('history paginates by project cursor, including equal timestamps, without crossing projects', async () => {
      await send(second).expect(200);
      const first = AssistantMessagesResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(path() + '?limit=1')
            .set(auth())
            .expect(200)
        ).body,
      );
      expect(first.hasMore).toBe(true);
      const next = AssistantMessagesResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(path() + `?limit=1&before=${first.items[0].id}`)
            .set(auth())
            .expect(200)
        ).body,
      );
      expect(next.items[0].id).not.toBe(first.items[0].id);
      expect(next.hasMore).toBe(false);
      const foreignCursor = await prisma.assistantMessage.findFirstOrThrow({
        where: { projectId: second },
      });
      await request(app.getHttpServer())
        .get(path() + `?before=${foreignCursor.id}`)
        .set(auth())
        .expect(404);
      // Tie timestamps explicitly; cursor uses (createdAt,id), not timestamp alone.
      await prisma.assistantMessage.updateMany({
        where: { projectId: project },
        data: { createdAt: new Date('2026-10-02T00:00:00Z') },
      });
      const tied = AssistantMessagesResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(path() + '?limit=1')
            .set(auth())
            .expect(200)
        ).body,
      );
      const older = AssistantMessagesResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get(path() + `?limit=1&before=${tied.items[0].id}`)
            .set(auth())
            .expect(200)
        ).body,
      );
      expect(older.items).toHaveLength(1);
    });

    it('offers media actions from safe project context without generating or attaching images', async () => {
      const ownKey = `assistant-media-${randomUUID()}`;
      const foreignKey = `assistant-media-${randomUUID()}`;
      mediaStorageKeys.push(ownKey, foreignKey);
      const ownAsset = await prisma.asset.create({
        data: {
          projectId: project,
          kind: 'IMAGE',
          name: 'Coffee photo',
          storageKey: ownKey,
          mimeType: 'image/png',
          byteSize: 3n,
          width: 100,
          height: 100,
          altText: 'Warm coffee photo',
        },
      });
      const foreignAsset = await prisma.asset.create({
        data: {
          projectId: foreign,
          kind: 'IMAGE',
          name: 'Foreign photo',
          storageKey: foreignKey,
          mimeType: 'image/png',
          byteSize: 3n,
          width: 100,
          height: 100,
        },
      });
      await prisma.contentAsset.create({
        data: { contentId: draftId, assetId: ownAsset.id, position: 0 },
      });
      const beforeImages = await prisma.generation.count({
        where: { userId: ids[pro], kind: 'IMAGE' },
      });
      const output = {
        text: 'Mình đề xuất tạo ảnh và gắn ảnh đã có; chưa thực hiện.',
        validationNote: 'Một số đề xuất không hợp lệ; hãy yêu cầu lại.',
        actions: [
          {
            type: 'generate_image',
            prompt: 'Warm coffee in natural light',
            name: null,
            size: '1024x1024',
            attachToContentId: draftId,
          },
          {
            type: 'attach_media',
            contentId: draftId,
            assetIds: [ownAsset.id],
            mode: 'append',
          },
          {
            type: 'attach_media',
            contentId: draftId,
            assetIds: [foreignAsset.id],
            mode: 'replace',
          },
          {
            type: 'attach_media',
            contentId: doneId,
            assetIds: [ownAsset.id],
            mode: 'replace',
          },
          {
            type: 'attach_media',
            contentId: draftId,
            assetIds: [ownAsset.id, ownAsset.id],
            mode: 'append',
          },
        ],
      };
      provider.mockImplementationOnce((system: string, prompt: string) => {
        expect(system).toContain('DỮ LIỆU KHÔNG TIN CẬY');
        expect(prompt).toContain(ownAsset.id);
        expect(prompt).toContain(`"assetIds":["${ownAsset.id}"]`);
        expect(prompt).not.toContain(foreignAsset.id);
        expect(prompt).not.toContain(ownKey);
        expect(prompt).not.toContain('storageKey');
        expect(prompt).not.toContain('https://');
        return {
          partialOutputStream: (async function* () {
            await Promise.resolve();
            yield { text: output.text };
          })(),
          output: Promise.resolve(output),
          finishReason: Promise.resolve('stop'),
          usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
        };
      });
      const result = done((await send().expect(200)).text);
      expect(
        result.assistantMessage.actions.map((action) => action.type),
      ).toEqual(['generate_image', 'attach_media']);
      expect(
        result.assistantMessage.actions.every(
          (action) => action.status === 'proposed',
        ),
      ).toBe(true);
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'IMAGE' },
        }),
      ).toBe(beforeImages);
      expect(
        await prisma.contentAsset.count({
          where: { contentId: draftId },
        }),
      ).toBe(1);
    });

    it('proposes a draft with existing/new image and an image-only edit, filtering foreign and DONE targets', async () => {
      const storageKey = `assistant-media-${randomUUID()}`;
      mediaStorageKeys.push(storageKey);
      const asset = await prisma.asset.create({
        data: {
          projectId: project,
          kind: 'IMAGE',
          name: 'Campaign photo',
          storageKey,
          mimeType: 'image/png',
          byteSize: 3n,
          width: 100,
          height: 100,
        },
      });
      const output = {
        text: 'Có hai đề xuất kèm ảnh, chưa áp dụng.',
        validationNote: 'Một số đề xuất không hợp lệ; hãy yêu cầu lại.',
        actions: [
          {
            type: 'create_draft',
            channel: 'FACEBOOK',
            title: 'Tiêu đề',
            body: `Hook ngắn\n${Array(80).fill('Nội-dung').join(' ')}`,
            hashtags: ['ThẻMột', 'ThẻHai'],
            cta: 'Khám phá ngay',
            assetIds: [asset.id],
            imagePrompt: 'Natural light campaign photo',
          },
          {
            type: 'edit_content',
            contentId: readyId,
            changes: [],
            assetIds: [asset.id],
            assetMode: 'replace',
            imagePrompt: null,
          },
          {
            type: 'edit_content',
            contentId: readyId,
            changes: [],
            assetIds: ['foreign-asset'],
            assetMode: 'append',
            imagePrompt: null,
          },
          {
            type: 'edit_content',
            contentId: doneId,
            changes: [],
            assetIds: [asset.id],
            assetMode: 'append',
            imagePrompt: null,
          },
        ],
      };
      provider.mockImplementationOnce(() => ({
        partialOutputStream: (async function* () {
          await Promise.resolve();
          yield { text: output.text };
        })(),
        output: Promise.resolve(output),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
      }));
      const beforeContent = await prisma.contentItem.count({
        where: { projectId: project },
      });
      const result = done((await send().expect(200)).text);
      expect(
        result.assistantMessage.actions.map((action) => action.type),
      ).toEqual(['create_draft', 'edit_content']);
      expect(
        result.assistantMessage.actions.every(
          (action) => action.status === 'proposed',
        ),
      ).toBe(true);
      expect(
        await prisma.contentItem.count({ where: { projectId: project } }),
      ).toBe(beforeContent);
      expect(
        await prisma.contentAsset.count({ where: { contentId: readyId } }),
      ).toBe(0);
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'IMAGE' },
        }),
      ).toBe(0);
    });

    it('action state moves only from proposed, including concurrent PATCH; does not apply the proposal', async () => {
      const action = lastDone.assistantMessage.actions[0];
      const route = `${path()}/${lastDone.assistantMessage.id}/actions/${action.id}`;
      const responses = await Promise.all(
        ['applied', 'dismissed'].map((status) =>
          request(app.getHttpServer())
            .patch(route)
            .set(auth())
            .send({ status }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      AssistantMessageSchema.parse(
        responses.find((r) => r.status === 200)!.body,
      );
      await request(app.getHttpServer())
        .patch(route)
        .set(auth())
        .send({ status: 'dismissed' })
        .expect(409);
      await request(app.getHttpServer())
        .patch(route)
        .set(auth())
        .send({ status: 'proposed' })
        .expect(400);
      await request(app.getHttpServer())
        .patch(route)
        .set(auth(other))
        .send({ status: 'applied' })
        .expect(404);
      expect(
        (
          await prisma.brandBrief.findUniqueOrThrow({
            where: { projectId: project },
          })
        ).tone,
      ).toBe('Thân thiện');
    });

    it('provider failure is an SSE error and remains billed, clearing in-flight history cannot recreate a reply', async () => {
      provider.mockImplementationOnce(() => ({
        partialOutputStream: (async function* () {
          await Promise.resolve();
          yield { text: 'Partial' };
          throw new Error('provider-secret');
        })(),
        output: Promise.resolve(null),
        usage: Promise.resolve({ inputTokens: 2, outputTokens: 1 }),
      }));
      const failure = await send().expect(200);
      expect(failure.text).toContain('event: error');
      expect(failure.text).not.toContain('provider-secret');
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'ASSISTANT', status: 'FAILED' },
        }),
      ).toBe(1);
      let entered!: () => void;
      let release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const resume = new Promise<void>((resolve) => {
        release = resolve;
      });
      provider.mockImplementationOnce(() => ({
        partialOutputStream: (async function* () {
          yield { text: 'Waiting' };
          entered();
          await resume;
          yield { text: 'Waiting done' };
        })(),
        output: Promise.resolve({
          text: 'Waiting done',
          validationNote: 'Hãy yêu cầu lại.',
          actions: [],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ inputTokens: 2, outputTokens: 1 }),
      }));
      const pending = send().then((response) => response);
      await started;
      await request(app.getHttpServer()).delete(path()).set(auth()).expect(204);
      release();
      const response = await pending;
      expect(response.text).toContain('event: error');
      expect(
        await prisma.assistantMessage.count({ where: { projectId: project } }),
      ).toBe(0);
      expect(
        await prisma.assistantMessage.count({ where: { projectId: second } }),
      ).toBe(2);
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'ASSISTANT', status: 'CANCELLED' },
        }),
      ).toBe(1);
      expect(
        await prisma.generation.findFirstOrThrow({
          where: {
            userId: ids[pro],
            kind: 'ASSISTANT',
            errorCode: 'HISTORY_CLEARED',
          },
        }),
      ).toMatchObject({ status: 'CANCELLED', tokensIn: 2, tokensOut: 1 });
    });

    it('repairs an invalid draft once in the same Generation and bills one user message', async () => {
      const before = await prisma.generation.count({
        where: { userId: ids[pro], kind: 'ASSISTANT' },
      });
      const draft = {
        type: 'create_draft',
        channel: 'FACEBOOK',
        title: 'Tiêu đề',
        body: 'Bài quá ngắn',
        hashtags: ['ThẻMột', 'ThẻHai'],
        cta: 'Khám phá ngay',
        assetIds: null,
        imagePrompt: null,
      };
      for (const body of [
        draft.body,
        `Hook ngắn\n${Array.from({ length: 80 }, () => 'Nội-dung').join(' ')}`,
      ]) {
        provider.mockImplementationOnce(() => {
          const output = {
            text: 'Mình đề xuất một bản nháp.',
            validationNote: 'Một số bản nháp chưa hợp lệ; hãy yêu cầu lại.',
            actions: [{ ...draft, body }],
          };
          return {
            partialOutputStream: (async function* () {
              await Promise.resolve();
              yield { text: output.text };
            })(),
            output: Promise.resolve(output),
            finishReason: Promise.resolve('stop'),
            usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
          };
        });
      }
      const calls = provider.mock.calls.length;
      const key = randomUUID();
      const result = done((await send(project, key).expect(200)).text);
      expect(result.assistantMessage.actions).toHaveLength(1);
      expect(result.assistantMessage.actions[0]).toMatchObject({
        type: 'create_draft',
        status: 'proposed',
      });
      expect(provider.mock.calls.length).toBe(calls + 2);
      expect(
        await prisma.generation.count({
          where: { userId: ids[pro], kind: 'ASSISTANT' },
        }),
      ).toBe(before + 1);
      expect(
        await prisma.generation.findUniqueOrThrow({
          where: { userId_requestId: { userId: ids[pro], requestId: key } },
        }),
      ).toMatchObject({
        quotaUnits: 1,
        status: 'SUCCEEDED',
        tokensIn: 20,
        tokensOut: 10,
      });
      expect(
        (
          await prisma.assistantMessage.findUniqueOrThrow({
            where: { id: result.assistantMessage.id },
          })
        ).actions,
      ).toHaveLength(1);
    });

    it('assistant quota is independent of TEXT, all statuses count, concurrent last slot cannot exceed 300', async () => {
      const { start, end } = new QuotaService().period();
      const base = {
        userId: ids[pro],
        projectId: project,
        model: 'test-model',
        input: {},
        briefSnapshot: {},
      };
      await prisma.generation.create({
        data: {
          ...base,
          requestId: randomUUID(),
          kind: 'TEXT',
          requestedOutputs: 3,
          quotaUnits: 200,
        },
      });
      const used = await prisma.generation.count({
        where: {
          userId: ids[pro],
          kind: 'ASSISTANT',
          createdAt: { gte: start, lt: end },
        },
      });
      await prisma.generation.createMany({
        data: Array.from({ length: 299 - used }, (_, index) => ({
          ...base,
          requestId: randomUUID(),
          kind: 'ASSISTANT' as const,
          quotaUnits: 1,
          requestedOutputs: 1,
          status: index % 2 ? ('FAILED' as const) : ('CANCELLED' as const),
          completedAt: new Date(),
          createdAt: start,
        })),
      });
      for (const date of [new Date(start.getTime() - 1), end])
        await prisma.generation.create({
          data: {
            ...base,
            requestId: randomUUID(),
            kind: 'ASSISTANT',
            createdAt: date,
          },
        });
      const calls = provider.mock.calls.length;
      const responses = await Promise.all([send(), send()]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 429]);
      expect(provider.mock.calls.length).toBe(calls + 1);
      expect(responses.find((r) => r.status === 429)!.body).toMatchObject({
        code: 'QUOTA_EXCEEDED',
        details: { limit: 300, used: 300, resetAt: end.toISOString() },
      });
      await send().expect(429);
      const usage = BillingUsageResponseSchema.parse(
        (
          await request(app.getHttpServer())
            .get('/api/billing/usage')
            .set(auth())
            .expect(200)
        ).body,
      );
      expect(usage.usage.assistant).toEqual({ used: 300, limit: 300 });
      expect(usage.usage.text).toEqual({ used: 200, limit: 200 });
      for (const user of [free, noFeature])
        expect(
          BillingUsageResponseSchema.parse(
            (
              await request(app.getHttpServer())
                .get('/api/billing/usage')
                .set(auth(user))
                .expect(200)
            ).body,
          ).usage,
        ).not.toHaveProperty('assistant');
      await request(app.getHttpServer()).delete(path()).set(auth()).expect(204);
      expect(
        await prisma.assistantMessage.count({ where: { projectId: project } }),
      ).toBe(0);
      await send().expect(429);
      const retained = await prisma.generation.findFirstOrThrow({
        where: { userId: ids[pro], projectId: project, kind: 'ASSISTANT' },
      });
      await send(project, retained.requestId).expect(409);
      // Permanent project deletion cascades messages but keeps the quota ledger.
      await prisma.project.delete({ where: { id: second } });
      expect(
        await prisma.assistantMessage.count({ where: { projectId: second } }),
      ).toBe(0);
      expect(
        BillingUsageResponseSchema.parse(
          (
            await request(app.getHttpServer())
              .get('/api/billing/usage')
              .set(auth())
              .expect(200)
          ).body,
        ).usage.assistant?.used,
      ).toBe(300);
    });

    it('user deletion cascades assistant messages and its quota ledger', async () => {
      await request(app.getHttpServer())
        .post(path(foreign))
        .set(auth(other))
        .set('Idempotency-Key', randomUUID())
        .send({ content: 'Gợi ý giúp tôi.' })
        .expect(200);
      expect(
        await prisma.assistantMessage.count({ where: { projectId: foreign } }),
      ).toBe(2);
      await prisma.user.delete({ where: { id: ids[other] } });
      expect(
        await prisma.assistantMessage.count({ where: { projectId: foreign } }),
      ).toBe(0);
      expect(
        await prisma.generation.count({
          where: { userId: ids[other], kind: 'ASSISTANT' },
        }),
      ).toBe(0);
    });

    it('Swagger exposes all assistant routes, shared schemas and Bearer auth', () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      const route = doc.paths['/api/projects/{projectId}/assistant/messages'];
      for (const method of ['get', 'post', 'delete'] as const)
        expect(route[method]?.security).toEqual([{ bearer: [] }]);
      expect(route.post?.responses['200']).toBeDefined();
      expect(
        doc.paths[
          '/api/projects/{projectId}/assistant/messages/{messageId}/actions/{actionId}'
        ].patch?.responses['409'],
      ).toBeDefined();
    });
  },
);
