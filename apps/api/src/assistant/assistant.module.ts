import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { OpenAiService } from '../ai/openai.service';
import { QuotaService } from '../ai/quota.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantRepository } from './assistant.repository';
import { AssistantPrompt } from './assistant-prompt';
import { AssistantGuard } from './assistant.guard';
import { AssistantApplyController } from './assistant-apply.controller';
import { AssistantApplyService } from './assistant-apply.service';
import { ContentModule } from '../content/content.module';
import { BrandModule } from '../brand/brand.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [ProjectsModule, ContentModule, BrandModule, MediaModule],
  controllers: [AssistantController, AssistantApplyController],
  providers: [
    AssistantService,
    AssistantApplyService,
    AssistantRepository,
    AssistantPrompt,
    AssistantGuard,
    OpenAiService,
    QuotaService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
