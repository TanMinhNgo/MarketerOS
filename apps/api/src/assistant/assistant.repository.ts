import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssistantActionSchema,
  type AssistantAction,
  type AssistantMessagesQuery,
} from '@marketos/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService, readAssistantUsage } from '../ai/quota.service';
import { PLAN_LIMITS } from '../billing/plan-limits';

const select = {
  id: true,
  role: true,
  content: true,
  actions: true,
  createdAt: true,
  automationId: true,
} as const;
const conflict = () =>
  new ConflictException({
    code: 'CONFLICT',
    message: 'Yêu cầu hoặc trạng thái đã được sử dụng.',
    details: null,
  });

@Injectable()
export class AssistantRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}
  private async lockProject(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Project" WHERE id=${projectId} AND "ownerId"=${userId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
  }
  async list(projectId: string, userId: string, query: AssistantMessagesQuery) {
    const where = { projectId, project: { ownerId: userId, deletedAt: null } };
    const cursor = query.before
      ? await this.prisma.assistantMessage.findFirst({
          where: { ...where, id: query.before },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.before && !cursor) throw new NotFoundException();
    const items = await this.prisma.assistantMessage.findMany({
      where: {
        ...where,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return {
      items: items.slice(0, query.limit),
      hasMore: items.length > query.limit,
    };
  }
  reserve(
    projectId: string,
    userId: string,
    requestId: string,
    content: string,
    model: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      await this.lockProject(tx, projectId, userId);
      if (
        await tx.generation.findUnique({
          where: { userId_requestId: { userId, requestId } },
          select: { id: true },
        })
      )
        throw conflict();
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { name: true, brandBrief: true },
      });
      if (!project.brandBrief)
        throw new NotFoundException('Brand Brief chưa được tạo.');
      const now = new Date();
      const { start, end } = this.quota.period(now);
      const used = await readAssistantUsage(tx, userId, start, end);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const limit =
        user.billingPlan === 'max'
          ? PLAN_LIMITS.max.assistant
          : PLAN_LIMITS.pro.assistant;
      if (used >= limit)
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Bạn đã hết tin nhắn Assistant trong kỳ này.',
            details: { limit, used, resetAt: end.toISOString() },
          },
          429,
        );
      const contents = await tx.contentItem.findMany({
        where: { projectId },
        select: {
          id: true,
          channel: true,
          title: true,
          body: true,
          hashtags: true,
          cta: true,
          status: true,
          scheduledAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
      });
      const history = await tx.assistantMessage.findMany({
        where: { projectId },
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 12,
      });
      const generation = await tx.generation.create({
        data: {
          projectId,
          userId,
          requestId,
          kind: 'ASSISTANT',
          input: {},
          briefSnapshot: {},
          model,
          requestedOutputs: 1,
          quotaUnits: 1,
          createdAt: now,
        },
        select: { id: true },
      });
      const userMessage = await tx.assistantMessage.create({
        data: {
          projectId,
          generationId: generation.id,
          role: 'user',
          content,
          createdAt: now,
        },
        select,
      });
      return {
        generationId: generation.id,
        userMessage,
        project,
        contents,
        history: history.reverse(),
      };
    });
  }
  contents(projectId: string, userId: string, ids: string[]) {
    return this.prisma.contentItem.findMany({
      where: {
        id: { in: ids },
        projectId,
        project: { ownerId: userId, deletedAt: null },
      },
      select: { id: true, status: true },
    });
  }
  async mediaContext(projectId: string, userId: string, contentIds: string[]) {
    const project = { ownerId: userId, deletedAt: null };
    const [assets, links] = await Promise.all([
      this.prisma.asset.findMany({
        where: { projectId, project },
        select: {
          id: true,
          name: true,
          kind: true,
          generationId: true,
          altText: true,
          width: true,
          height: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 30,
      }),
      this.prisma.contentAsset.findMany({
        where: {
          contentId: { in: contentIds },
          content: { projectId, project },
          asset: { projectId },
        },
        select: { contentId: true, assetId: true, position: true },
        orderBy: [{ contentId: 'asc' }, { position: 'asc' }],
      }),
    ]);
    return { assets, links };
  }
  assets(projectId: string, userId: string, ids: string[]) {
    return this.prisma.asset.findMany({
      where: {
        id: { in: ids },
        projectId,
        project: { ownerId: userId, deletedAt: null },
      },
      select: { id: true },
    });
  }
  finish(
    projectId: string,
    userId: string,
    generationId: string,
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
    tokensIn: number | null,
    tokensOut: number | null,
    output?: { content: string; actions: AssistantAction[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const project = await tx.project.findFirst({
        where: { id: projectId, ownerId: userId, deletedAt: null },
        select: { id: true },
      });
      if (project) await this.lockProject(tx, projectId, userId);
      const userMessage = await tx.assistantMessage.findFirst({
        where: { projectId, generationId, role: 'user' },
        select,
      });
      const finalStatus = project && userMessage ? status : 'CANCELLED';
      let errorCode: string | null = null;
      if (finalStatus === 'FAILED') errorCode = 'AI_ASSISTANT_FAILED';
      else if (finalStatus === 'CANCELLED') errorCode = 'CANCELLED';
      const updated = await tx.generation.updateMany({
        where: {
          id: generationId,
          userId,
          kind: 'ASSISTANT',
          status: 'PENDING',
        },
        data: {
          status: finalStatus,
          completedOutputs: finalStatus === 'SUCCEEDED' ? 1 : 0,
          completedAt: new Date(),
          tokensIn,
          tokensOut,
          errorCode,
        },
      });
      if (!updated.count && (tokensIn !== null || tokensOut !== null)) {
        // A cleared reply stays cancelled; retain measured cost without recreating chat.
        await tx.generation.updateMany({
          where: {
            id: generationId,
            userId,
            kind: 'ASSISTANT',
            status: 'CANCELLED',
            errorCode: 'HISTORY_CLEARED',
          },
          data: { tokensIn, tokensOut },
        });
      }
      if (
        !updated.count ||
        finalStatus !== 'SUCCEEDED' ||
        !output ||
        !userMessage
      )
        return null;
      const assistantMessage = await tx.assistantMessage.create({
        data: {
          projectId,
          generationId,
          role: 'assistant',
          content: output.content,
          actions: output.actions,
          createdAt: new Date(),
        },
        select,
      });
      return { userMessage, assistantMessage };
    });
  }
  clear(projectId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      await this.lockProject(tx, projectId, userId);
      await tx.generation.updateMany({
        where: { userId, projectId, kind: 'ASSISTANT', status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          errorCode: 'HISTORY_CLEARED',
        },
      });
      await tx.assistantMessage.deleteMany({ where: { projectId } });
    });
  }
  updateAction(
    projectId: string,
    userId: string,
    messageId: string,
    actionId: string,
    status: 'applied' | 'dismissed',
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockProject(tx, projectId, userId);
      const message = await tx.assistantMessage.findFirst({
        where: { id: messageId, projectId, role: 'assistant' },
        select,
      });
      if (!message) throw new NotFoundException();
      const actions = AssistantActionSchema.array().parse(message.actions);
      const action = actions.find((item) => item.id === actionId);
      if (!action) throw new NotFoundException();
      if (action.status !== 'proposed') throw conflict();
      action.status = status;
      return tx.assistantMessage.update({
        where: { id: messageId },
        data: { actions },
        select,
      });
    });
  }
}
