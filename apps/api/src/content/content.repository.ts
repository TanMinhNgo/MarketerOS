import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ContentListQuery,
  CreateContentInput,
  UpdateContentInput,
} from '@marketos/shared';
import { PrismaService } from '../prisma/prisma.service';

const select = {
  id: true,
  projectId: true,
  generationId: true,
  channel: true,
  title: true,
  body: true,
  hashtags: true,
  cta: true,
  status: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, ownerId: string, query: ContentListQuery) {
    const { page, limit, status } = query;
    const where = {
      projectId,
      project: { ownerId, deletedAt: null },
      ...(status ? { status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentItem.findMany({
        select,
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contentItem.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(projectId: string, ownerId: string, id: string) {
    const content = await this.prisma.contentItem.findFirst({
      select,
      where: { id, projectId, project: { ownerId, deletedAt: null } },
    });
    if (!content) throw new NotFoundException();
    return content;
  }

  async create(projectId: string, ownerId: string, input: CreateContentInput) {
    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      if (input.generationId) {
        const generation = await tx.generation.findFirst({
          where: {
            id: input.generationId,
            projectId,
            userId: ownerId,
            kind: 'TEXT',
            status: 'SUCCEEDED',
            input: { path: ['channel'], equals: input.channel },
          },
          select: { id: true },
        });
        if (!generation) throw new NotFoundException();
      }
      return tx.contentItem.create({
        data: { ...input, projectId, status: 'DRAFT' },
        select,
      });
    });
  }

  async update(
    projectId: string,
    ownerId: string,
    id: string,
    input: UpdateContentInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      const content = await tx.contentItem.findFirst({
        where: { id, projectId, project: { ownerId, deletedAt: null } },
        select: { id: true },
      });
      if (!content) throw new NotFoundException();
      return tx.contentItem.update({ where: { id }, data: input, select });
    });
  }

  async delete(projectId: string, ownerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      const content = await tx.contentItem.findFirst({
        where: { id, projectId, project: { ownerId, deletedAt: null } },
        select: { id: true },
      });
      if (!content) throw new NotFoundException();
      return tx.contentItem.delete({ where: { id }, select });
    });
  }
}
