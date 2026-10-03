import { Module } from '@nestjs/common';
import { AutomationModule } from './automation/automation.module';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { validateEnvironment } from './common/env';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BillingModule } from './billing/billing.module';
import { AssistantModule } from './assistant/assistant.module';
import { ProjectsModule } from './projects/projects.module';
import { BrandModule } from './brand/brand.module';
import { ContentModule } from './content/content.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    AutomationModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
      validate: validateEnvironment,
    }),
    AuthModule,
    UsersModule,
    BillingModule,
    AssistantModule,
    ProjectsModule,
    BrandModule,
    ContentModule,
    AiModule,
    PrismaModule,
    IntegrationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
