import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { OwnershipGuard } from './ownership.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository, OwnershipGuard],
  exports: [ProjectsRepository, OwnershipGuard],
})
export class ProjectsModule {}
