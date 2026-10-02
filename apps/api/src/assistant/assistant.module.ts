import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { OpenAiService } from '../ai/openai.service';
import { QuotaService } from '../ai/quota.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantRepository } from './assistant.repository';
import { AssistantPrompt } from './assistant-prompt';
import { AssistantGuard } from './assistant.guard';

@Module({
  imports: [ProjectsModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantRepository,
    AssistantPrompt,
    AssistantGuard,
    OpenAiService,
    QuotaService,
  ],
})
export class AssistantModule {}
