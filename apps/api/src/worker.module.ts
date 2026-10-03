import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { validateEnvironment } from './common/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AssistantModule } from './assistant/assistant.module';
import { AutomationModule } from './automation/automation.module';
import { AutomationExecutor } from './automation/automation.executor';
import { AutomationWorker } from './automation/automation.worker';
import { PromptBuilder } from './ai/prompt-builder';
import { IntegrationsModule } from './integrations/integrations.module';
import { PublicationWorker } from './integrations/publication.worker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    AssistantModule,
    AutomationModule,
    IntegrationsModule,
  ],
  providers: [
    AutomationExecutor,
    AutomationWorker,
    PublicationWorker,
    PromptBuilder,
  ],
})
export class WorkerModule {}
