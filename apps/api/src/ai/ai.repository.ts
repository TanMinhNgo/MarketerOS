import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GenerateContentInput } from '@marketos/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { readTextUsage, textUsage } from './quota.service';

@Injectable()
export class AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  brief(projectId: string, ownerId: string) {
    return this.prisma.brandBrief.findFirst({
      where: { projectId, project: { ownerId, deletedAt: null } },
    });
  }

  reserve(
    projectId: string,
    userId: string,
    requestId: string,
    input: GenerateContentInput,
    briefSnapshot: Prisma.InputJsonValue,
    model: string,
    limit: number,
    start: Date,
    end: Date,
    requestedOutputs: 1 | 3 = 3,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id = ${projectId} AND "ownerId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      if (
        await tx.generation.findUnique({
          where: { userId_requestId: { userId, requestId } },
          select: { id: true },
        })
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Request ID đã được sử dụng; tạo ID mới để thử lại.',
          details: null,
        });
      await tx.generation.updateMany({
        where: {
          userId,
          kind: 'TEXT',
          status: 'PENDING',
          createdAt: { lt: new Date(Date.now() - 30 * 60_000) },
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorCode: 'INTERRUPTED',
        },
      });
      const { units, regenerations, used } = await readTextUsage(
        tx,
        userId,
        start,
        end,
      );
      const quotaUnits = requestedOutputs === 1 ? 0 : 1;
      const nextUsed = textUsage(
        units + quotaUnits,
        regenerations + (requestedOutputs === 1 ? 1 : 0),
      );
      if (nextUsed > limit)
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Bạn đã dùng hết lượt tạo nội dung trong kỳ này.',
            details: {
              limit,
              used,
              resetAt: end.toISOString(),
            },
          },
          429,
        );
      return tx.generation.create({
        data: {
          projectId,
          userId,
          requestId,
          input,
          briefSnapshot,
          model,
          kind: 'TEXT',
          requestedOutputs,
          quotaUnits,
          status: 'PENDING',
        },
        select: { id: true },
      });
    });
  }

  finish(
    id: string,
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
    tokensIn: number | null,
    tokensOut: number | null,
    errorCode: string | null,
    completedOutputs: 1 | 3 = 3,
  ) {
    return this.prisma.generation.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        completedOutputs: status === 'SUCCEEDED' ? completedOutputs : 0,
        completedAt: new Date(),
        tokensIn,
        tokensOut,
        errorCode,
      },
    });
  }
}
