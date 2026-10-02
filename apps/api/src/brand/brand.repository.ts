import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpsertBrandBriefInput } from '@marketos/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandRepository {
  constructor(private readonly prisma: PrismaService) {}
  find(projectId: string, ownerId: string) {
    return this.prisma.brandBrief.findFirst({
      where: { projectId, project: { ownerId, deletedAt: null } },
    });
  }
  upsert(projectId: string, ownerId: string, data: UpsertBrandBriefInput) {
    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      return tx.brandBrief.upsert({
        where: { projectId },
        create: { ...data, projectId },
        update: data,
      });
    });
  }
}
