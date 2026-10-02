import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ProjectsModule } from '../projects/projects.module';
import { AiController } from './ai.controller';
import { AiRepository } from './ai.repository';
import { AiService } from './ai.service';
import { OpenAiService } from './openai.service';
import { PromptBuilder } from './prompt-builder';
import { QuotaService } from './quota.service';

@Module({
  imports: [
    ProjectsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [AiController],
  providers: [
    AiRepository,
    AiService,
    OpenAiService,
    PromptBuilder,
    QuotaService,
    ThrottlerGuard,
  ],
})
export class AiModule {}
