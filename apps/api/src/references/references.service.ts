import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ReferenceInput } from '@marketos/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function textReferences(
  db: Pick<Prisma.TransactionClient, 'personalReference'>,
  projectId: string,
  userId: string,
) {
  return db.personalReference.findMany({
    where: {
      projectId,
      userId,
      kind: 'TEXT',
      enabled: true,
      project: { ownerId: userId, deletedAt: null },
    },
    select: { title: true, contentText: true, purpose: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 10,
  });
}

@Injectable()
export class ReferencesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(projectId: string, userId: string) {
    if (
      !(await this.prisma.project.findFirst({
        where: { id: projectId, ownerId: userId, deletedAt: null },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    const rows = await this.prisma.personalReference.findMany({
      where: {
        projectId,
        userId,
        kind: 'TEXT',
        project: { ownerId: userId, deletedAt: null },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        projectId: row.projectId!,
        title: row.title,
        contentText: row.contentText!,
        purpose: row.purpose,
        enabled: row.enabled,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
  async write(
    projectId: string,
    userId: string,
    input?: ReferenceInput,
    id?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const projects = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Project" WHERE id=${projectId} AND "ownerId"=${userId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!projects.length) throw new NotFoundException();
      if (
        id &&
        !(await tx.personalReference.findFirst({
          where: { id, projectId, userId, kind: 'TEXT' },
        }))
      )
        throw new NotFoundException();
      if (!input) {
        await tx.personalReference.delete({ where: { id: id! } });
        return;
      }
      if (id) {
        await tx.personalReference.update({
          where: { id },
          data: { ...input, version: { increment: 1 } },
        });
        return;
      }
      if (
        (await tx.personalReference.count({
          where: { projectId, userId, kind: 'TEXT' },
        })) >= 10
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Tối đa 10 reference chữ mỗi dự án.',
          details: { limit: 10 },
        });
      await tx.personalReference.create({
        data: { ...input, projectId, userId, kind: 'TEXT' },
      });
    });
  }
}
