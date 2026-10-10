import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { QuotaService } from '../ai/quota.service';
import { MediaController } from './media.controller';
import { MediaGuard } from './media.guard';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { MediaStorage } from './media.storage';
import { ImageProvider } from './image-provider';

@Module({
  imports: [ProjectsModule],
  controllers: [MediaController],
  providers: [
    MediaGuard,
    MediaRepository,
    MediaService,
    MediaStorage,
    ImageProvider,
    QuotaService,
  ],
  exports: [MediaStorage, MediaService, MediaRepository],
})
export class MediaModule {}
