import type { Prisma } from '../generated/prisma/client';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const { page, limit, status, from, to, unscheduled } = query;
    const where = {
      projectId,
      project: { ownerId, deletedAt: null },
      ...(status ? { status } : {}),
      ...(from && to
        ? { scheduledAt: { gte: new Date(from), lt: new Date(to) } }
        : unscheduled === 'true'
          ? { scheduledAt: null }
          : {}),
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

  async create(
    projectId: string,
    ownerId: string,
    input: CreateContentInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
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
    };
    return transaction ? work(transaction) : this.prisma.$transaction(work);
  }

  async update(
    projectId: string,
    ownerId: string,
    id: string,
    input: UpdateContentInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      const content = await tx.contentItem.findFirst({
        where: { id, projectId, project: { ownerId, deletedAt: null } },
        select: { id: true, status: true, scheduledAt: true },
      });
      if (!content) throw new NotFoundException();
      if (
        await tx.publication.count({
          where: { contentId: id, status: 'PUBLISHING' },
        })
      )
        throw new ConflictException(
          'Cannot change content while publication is active.',
        );
      const conflict = (message: string) =>
        new ConflictException({
          code: 'CONFLICT',
          message,
          details: {
            status: content.status,
            requestedStatus: input.status ?? null,
          },
        });
      const editsText = ['title', 'body', 'hashtags', 'cta'].some(
        (field) => field in input,
      );
      if (editsText && content.status === 'DONE')
        throw conflict('Bài đã hoàn tất không thể sửa nội dung.');
      if (editsText && input.status && input.status !== 'DRAFT')
        throw conflict('Cần duyệt lại sau khi sửa nội dung.');
      if (editsText && input.scheduledAt !== undefined)
        throw conflict('Không thể vừa sửa nội dung vừa đổi lịch.');

      const allowed = {
        DRAFT: ['DRAFT', 'READY'],
        READY: ['DRAFT', 'READY', 'SCHEDULED'],
        SCHEDULED: ['DRAFT', 'READY', 'SCHEDULED', 'DONE'],
        DONE: ['READY', 'SCHEDULED', 'DONE'],
      } as const;
      const nextStatus =
        editsText && content.status !== 'DRAFT'
          ? 'DRAFT'
          : (input.status ?? content.status);
      if (!(allowed[content.status] as readonly string[]).includes(nextStatus))
        throw conflict('Chuyển trạng thái không hợp lệ.');
      if (
        content.status === 'SCHEDULED' &&
        nextStatus === 'DRAFT' &&
        !editsText
      )
        throw conflict('Cần chuyển bài về READY trước khi bỏ duyệt.');

      let scheduledAt = content.scheduledAt;
      if (nextStatus === 'READY') {
        if (input.scheduledAt != null && input.scheduledAt !== undefined)
          throw conflict('Bài READY không có lịch đăng.');
        scheduledAt = null;
      } else if (input.scheduledAt !== undefined) {
        if (nextStatus === 'SCHEDULED' && input.scheduledAt === null)
          throw conflict('Bài SCHEDULED cần scheduledAt.');
        if (nextStatus === 'DONE' && input.scheduledAt === null)
          throw conflict('Không thể xóa lịch của bài DONE.');
        if (
          content.status === 'DRAFT' &&
          nextStatus === 'DRAFT' &&
          input.scheduledAt !== null
        )
          throw conflict('Cần duyệt bài trước khi lên lịch.');
        scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      }
      if (nextStatus === 'SCHEDULED' && !scheduledAt)
        throw conflict('Bài SCHEDULED cần scheduledAt.');
      if (content.status === 'READY' && nextStatus === 'DRAFT')
        scheduledAt = null;

      await tx.publication.updateMany({
        where: { contentId: id, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
      return tx.contentItem.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          hashtags: input.hashtags,
          cta: input.cta,
          status: nextStatus,
          scheduledAt,
        },
        select,
      });
    };
    return transaction ? work(transaction) : this.prisma.$transaction(work);
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
