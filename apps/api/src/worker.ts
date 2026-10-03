import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.get(ConfigService).getOrThrow<string>('REDIS_URL');
  app.enableShutdownHooks();
}
bootstrap().catch(() => {
  console.error(
    'Automation worker startup failed. Check backend env, database and Redis.',
  );
  process.exitCode = 1;
});
