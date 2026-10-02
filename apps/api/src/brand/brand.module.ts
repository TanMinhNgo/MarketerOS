import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { BrandRepository } from './brand.repository';

@Module({
  imports: [ProjectsModule],
  controllers: [BrandController],
  providers: [BrandService, BrandRepository],
})
export class BrandModule {}
