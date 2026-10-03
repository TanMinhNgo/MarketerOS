import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { QuotaService } from '../ai/quota.service';
import { AutomationController } from './automation.controller';
import { AutomationRepository } from './automation.repository';
import { AutomationGuard } from './automation.guard';

@Module({
  imports: [ProjectsModule],
  controllers: [AutomationController],
  providers: [AutomationRepository, AutomationGuard, QuotaService],
  exports: [AutomationRepository],
})
export class AutomationModule {}
