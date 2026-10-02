import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/common/configure-app';
import { ApiErrorSchema, HealthResponseSchema } from '@marketos/shared';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const query = jest.fn();

  beforeEach(async () => {
    query.mockReset().mockResolvedValue([{ result: 1 }]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: query })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('reports readiness and a safe 503 during a database outage', async () => {
    const healthy = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(HealthResponseSchema.parse(healthy.body)).toEqual({
      status: 'ok',
      db: 'up',
    });
    query.mockRejectedValueOnce(
      new Error('sensitive-database-connection-string'),
    );
    const failed = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(ApiErrorSchema.parse(failed.body).code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(failed.body)).not.toContain('sensitive');
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('normalizes 404, serves OpenAPI and restricts CORS to WEB_URL', async () => {
    const missing = await request(app.getHttpServer())
      .get('/api/missing')
      .expect(404);
    expect(ApiErrorSchema.parse(missing.body).code).toBe('NOT_FOUND');
    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(
      (docs.body as { paths: Record<string, unknown> }).paths['/api/health'],
    ).toBeDefined();
    const allowed = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    const denied = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
