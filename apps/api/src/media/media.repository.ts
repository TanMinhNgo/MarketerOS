import type { Prisma } from '../generated/prisma/client';
import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssetListQuery,
  GenerateImageInput,
  ReplaceContentAssetsInput,
} from '@marketos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../ai/quota.service';

@Injectable()
export class MediaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}

  brief(projectId: string, ownerId: string) {
    return this.prisma.brandBrief.findFirst({
      where: { projectId, project: { ownerId, deletedAt: null } },
    });
  }

  async reserve(
    projectId: string,
    userId: string,
    requestId: string,
    input: GenerateImageInput,
    briefSnapshot: object,
    model: string,
    limit: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const project = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!project.length) throw new NotFoundException();
      const reservedAt = new Date();
      const { start, end } = this.quota.period(reservedAt);
      const existing = await tx.generation.findUnique({
        where: { userId_requestId: { userId, requestId } },
        select: { id: true },
      });
      if (existing)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Request ID đã được sử dụng.',
          details: null,
        });
      const used = await tx.generation.count({
        where: { userId, kind: 'IMAGE', createdAt: { gte: start, lt: end } },
      });
      if (used >= limit)
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Bạn đã dùng hết lượt tạo ảnh trong kỳ này.',
            details: { limit, used, resetAt: end.toISOString() },
          },
          429,
        );
      return tx.generation.create({
        data: {
          userId,
          projectId,
          requestId,
          input,
          briefSnapshot,
          model,
          kind: 'IMAGE',
          requestedOutputs: 1,
          quotaUnits: 1,
          status: 'PENDING',
          createdAt: reservedAt,
        },
        select: { id: true },
      });
    });
  }

  finish(
    id: string,
    status: 'SUCCEEDED' | 'FAILED',
    completedOutputs: number,
    errorCode: string | null,
  ) {
    return this.prisma.generation.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        completedOutputs,
        errorCode,
        completedAt: new Date(),
      },
    });
  }

  create(
    projectId: string,
    data: {
      generationId?: string;
      name: string;
      storageKey: string;
      mimeType: string;
      byteSize: bigint;
      width: number;
      height: number;
      altText?: string;
    },
  ) {
    return this.prisma.asset.create({
      data: { projectId, kind: 'IMAGE', ...data },
    });
  }

  createGenerated(
    projectId: string,
    data: {
      generationId: string;
      name: string;
      storageKey: string;
      mimeType: string;
      byteSize: bigint;
      width: number;
      height: number;
      altText?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const generation = await tx.generation.findFirst({
        where: {
          id: data.generationId,
          projectId,
          kind: 'IMAGE',
          status: 'PENDING',
        },
        select: { id: true },
      });
      if (!generation)
        throw new ConflictException('Image generation is no longer pending.');
      const asset = await tx.asset.create({
        data: { projectId, kind: 'IMAGE', ...data },
      });
      await tx.generation.update({
        where: { id: data.generationId },
        data: {
          status: 'SUCCEEDED',
          completedOutputs: 1,
          completedAt: new Date(),
        },
      });
      return asset;
    });
  }

  async list(projectId: string, ownerId: string, query: AssetListQuery) {
    if (query.before) {
      const cursor = await this.prisma.asset.findFirst({
        where: {
          id: query.before,
          projectId,
          project: { ownerId, deletedAt: null },
        },
        select: { id: true },
      });
      if (!cursor) throw new NotFoundException();
    }
    const where = {
      projectId,
      project: { ownerId, deletedAt: null },
      ...(query.kind ? { kind: query.kind } : {}),
    };
    const rows = await this.prisma.asset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, query.limit),
      hasMore: rows.length > query.limit,
    };
  }

  async get(projectId: string, ownerId: string, id: string) {
    const row = await this.prisma.asset.findFirst({
      where: { id, projectId, project: { ownerId, deletedAt: null } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async remove(projectId: string, ownerId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!project.length) throw new NotFoundException();
      const row = await tx.asset.findFirst({
        where: { id, projectId },
        include: { contents: { select: { contentId: true } } },
      });
      if (!row) throw new NotFoundException();
      if (row.contents.length)
        throw new ConflictException(
          'Detach asset from content before deletion.',
        );
      await tx.asset.delete({ where: { id } });
      return row;
    });
  }

  async contentAssets(projectId: string, ownerId: string, contentId: string) {
    const content = await this.prisma.contentItem.findFirst({
      where: {
        id: contentId,
        projectId,
        project: { ownerId, deletedAt: null },
      },
      select: {
        assets: { orderBy: { position: 'asc' }, include: { asset: true } },
      },
    });
    if (!content) throw new NotFoundException();
    return content.assets.map((link) => link.asset);
  }

  async replaceContentAssets(
    projectId: string,
    ownerId: string,
    contentId: string,
    input: ReplaceContentAssetsInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      const project = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${ownerId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!project.length) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${contentId} AND "projectId"=${projectId} FOR UPDATE`;
      const content = await tx.contentItem.findFirst({
        where: { id: contentId, projectId },
        select: { status: true },
      });
      if (!content) throw new NotFoundException();
      const existing = await tx.contentAsset.findMany({
        where: { contentId },
        orderBy: { position: 'asc' },
        select: { assetId: true },
      });
      const unchanged =
        existing.length === input.assetIds.length &&
        existing.every((link, index) => link.assetId === input.assetIds[index]);
      if (unchanged) {
        const links = await tx.contentAsset.findMany({
          where: { contentId },
          orderBy: { position: 'asc' },
          include: { asset: true },
        });
        return links.map((link) => link.asset);
      }
      if (content.status === 'DONE')
        throw new ConflictException('Cannot change media on a completed post.');
      const publishing = await tx.publication.count({
        where: { contentId, status: 'PUBLISHING' },
      });
      if (publishing)
        throw new ConflictException(
          'Cannot change media while publication is active.',
        );
      const count = await tx.asset.count({
        where: { id: { in: input.assetIds }, projectId },
      });
      if (count !== input.assetIds.length)
        throw new NotFoundException('Asset not found in project.');
      await tx.publication.updateMany({
        where: { contentId, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
      await tx.contentItem.update({
        where: { id: contentId },
        data: { status: 'DRAFT', scheduledAt: null, updatedAt: new Date() },
      });
      await tx.contentAsset.deleteMany({ where: { contentId } });
      if (input.assetIds.length)
        await tx.contentAsset.createMany({
          data: input.assetIds.map((assetId, position) => ({
            contentId,
            assetId,
            position,
          })),
        });
      const links = await tx.contentAsset.findMany({
        where: { contentId },
        orderBy: { position: 'asc' },
        include: { asset: true },
      });
      return links.map((link) => link.asset);
    };
    return transaction ? work(transaction) : this.prisma.$transaction(work);
  }
}
