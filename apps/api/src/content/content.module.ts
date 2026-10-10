import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';

@Module({
  imports: [ProjectsModule],
  controllers: [ContentController],
  providers: [ContentRepository, ContentService],
  exports: [ContentRepository],
})
export class ContentModule {}
