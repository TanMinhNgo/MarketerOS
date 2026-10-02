import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
} from '@marketos/shared';
import { PrismaService } from '../prisma/prisma.service';

const select = {
  id: true,
  name: true,
  color: true,
  icon: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(ownerId: string, query: ProjectListQuery, trash: boolean) {
    const where = { ownerId, deletedAt: trash ? { not: null } : null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        select,
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total, ...query };
  }
  find(id: string, ownerId: string, includeDeleted = false) {
    return this.prisma.project.findFirst({
      select,
      where: { id, ownerId, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  }
  create(ownerId: string, data: CreateProjectInput) {
    return this.prisma.project.create({ data: { ...data, ownerId }, select });
  }
  update(id: string, ownerId: string, data: UpdateProjectInput) {
    return this.prisma.project.update({
      select,
      where: { id, ownerId, deletedAt: null },
      data,
    });
  }
  restore(id: string, ownerId: string) {
    return this.prisma.project.update({
      select,
      where: { id, ownerId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }
  trash(id: string, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        select,
        where: { id, ownerId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.publication.updateMany({
        where: { connection: { projectId: id }, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
      await tx.behaviorProfile.deleteMany({ where: { userId: ownerId } });
      return project;
    });
  }
  async owned(id: string, ownerId: string, includeDeleted = false) {
    const project = await this.find(id, ownerId, includeDeleted);
    if (!project) throw new NotFoundException();
    return project;
  }
}
