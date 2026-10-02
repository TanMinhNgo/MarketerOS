import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
  PlanKey,
} from '@marketos/shared';
import type { Prisma } from '../generated/prisma/client';
import { PLAN_LIMITS } from '../billing/plan-limits';
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
  create(ownerId: string, data: CreateProjectInput, plan: PlanKey) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
      await this.checkLimit(tx, ownerId, plan);
      return tx.project.create({ data: { ...data, ownerId }, select });
    });
  }
  update(id: string, ownerId: string, data: UpdateProjectInput) {
    return this.prisma.project.update({
      select,
      where: { id, ownerId, deletedAt: null },
      data,
    });
  }
  restore(id: string, ownerId: string, plan: PlanKey) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
      const where = { id, ownerId, deletedAt: { not: null } };
      if (!(await tx.project.findFirst({ where, select: { id: true } })))
        throw new NotFoundException();
      await this.checkLimit(tx, ownerId, plan);
      return tx.project.update({ select, where, data: { deletedAt: null } });
    });
  }
  private async checkLimit(
    tx: Prisma.TransactionClient,
    ownerId: string,
    plan: PlanKey,
  ) {
    const used = await tx.project.count({
      where: { ownerId, deletedAt: null },
    });
    const limit = PLAN_LIMITS[plan].projects;
    if (used >= limit)
      throw new ForbiddenException({
        code: 'PLAN_LIMIT',
        message: 'Bạn đã đạt giới hạn dự án đang hoạt động.',
        details: { limit, used, plan },
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
