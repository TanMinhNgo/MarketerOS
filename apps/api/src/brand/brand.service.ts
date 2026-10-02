import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpsertBrandBriefInput } from '@marketos/shared';
import { BrandRepository } from './brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly brand: BrandRepository) {}
  async get(projectId: string, ownerId: string) {
    const brief = await this.brand.find(projectId, ownerId);
    if (!brief) throw new NotFoundException();
    return brief;
  }
  upsert(projectId: string, ownerId: string, data: UpsertBrandBriefInput) {
    return this.brand.upsert(projectId, ownerId, data);
  }
}
