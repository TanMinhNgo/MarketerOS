import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AutomationSchema,
  AutomationRunSchema,
  CreateAutomationSchema,
  type AutomationRunsQuery,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from '@marketos/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type {
  Automation,
  AutomationRun,
  Prisma,
} from '../generated/prisma/client';
import { QuotaService } from '../ai/quota.service';
import { PLAN_LIMITS } from '../billing/plan-limits';
import { nextRunAt } from './automation-schedule';
import { cancelQueued, pauseAutomations } from './automation-lifecycle';

export function automationResponse(row: Automation) {
  return AutomationSchema.parse({
    ...(row.config as object),
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    enabled: row.enabled,
    schedule: row.schedule,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
export function runResponse(row: AutomationRun) {
  return AutomationRunSchema.parse({
    id: row.id,
    automationId: row.automationId,
    trigger: row.trigger,
    status: row.status,
    summary: row.summary,
    createdContentIds: row.createdContentIds,
    scheduledContentIds: row.scheduledContentIds,
    assistantMessageId: row.assistantMessageId,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  });
}
export function automationData(input: CreateAutomationInput) {
  const { name, type, enabled, schedule, ...config } = input;
  return {
    name,
    type,
    enabled,
    schedule,
    config,
    nextRunAt: enabled ? nextRunAt(schedule) : null,
  };
}
export function readAutomationUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date,
) {
  return tx.generation.count({
    where: { userId, kind: 'AUTOMATION', createdAt: { gte: start, lt: end } },
  });
}

@Injectable()
export class AutomationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly config: ConfigService,
  ) {}
  async lock(tx: Prisma.TransactionClient, userId: string, projectId: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Project" WHERE id=${projectId} AND "ownerId"=${userId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
  }
  async owned(tx: Prisma.TransactionClient, id: string, projectId: string) {
    const item = await tx.automation.findFirst({ where: { id, projectId } });
    if (!item) throw new NotFoundException();
    return item;
  }
  async checkLimit(tx: Prisma.TransactionClient, userId: string) {
    const used = await tx.automation.count({
      where: { enabled: true, project: { ownerId: userId } },
    });
    const limit = PLAN_LIMITS.max.automations;
    if (used >= limit)
      throw new ConflictException({
        code: 'PLAN_LIMIT',
        message: 'Đã đủ số tác vụ tự động đang bật.',
        details: { limit, used, plan: 'max' },
      });
  }
  async list(projectId: string, userId: string) {
    const items = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      return tx.automation.findMany({
        where: { projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });
    return { items: items.map(automationResponse) };
  }
  create(projectId: string, userId: string, input: CreateAutomationInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      if (input.enabled) await this.checkLimit(tx, userId);
      return automationResponse(
        await tx.automation.create({
          data: { ...automationData(input), projectId },
        }),
      );
    });
  }
  update(
    projectId: string,
    userId: string,
    id: string,
    patch: UpdateAutomationInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      const item = await this.owned(tx, id, projectId);
      const input = {
        ...(item.config as object),
        name: item.name,
        type: item.type,
        enabled: item.enabled,
        schedule: item.schedule,
      };
      const merged = CreateAutomationSchema.safeParse({ ...input, ...patch });
      if (!merged.success) throw new BadRequestException();
      if (!item.enabled && merged.data.enabled)
        await this.checkLimit(tx, userId);
      const data = automationData(merged.data);
      if (!patch.schedule && item.enabled === merged.data.enabled)
        data.nextRunAt = item.nextRunAt;
      if (!merged.data.enabled)
        await cancelQueued(tx, [id], 'Tác vụ đã tạm dừng.');
      return automationResponse(
        await tx.automation.update({ where: { id }, data }),
      );
    });
  }
  delete(projectId: string, userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      await this.owned(tx, id, projectId);
      await cancelQueued(tx, [id], 'Tác vụ đã xoá.');
      // Keep the Generation ledger: deleting schedules/history never refunds quota.
      await tx.generation.updateMany({
        where: {
          automationRun: { automationId: id },
          kind: 'AUTOMATION',
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          errorCode: 'AUTOMATION_DELETED',
        },
      });
      await tx.automation.delete({ where: { id } });
    });
  }
  reserve(
    projectId: string,
    userId: string,
    id: string,
    requestId: string,
    scheduledFor?: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      const item = await this.owned(tx, id, projectId);
      if (
        scheduledFor &&
        (!item.enabled || item.nextRunAt?.getTime() !== scheduledFor.getTime())
      )
        return null;
      if (!scheduledFor && !item.enabled)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Bật tác vụ trước khi chạy.',
          details: null,
        });
      if (
        await tx.generation.findUnique({
          where: { userId_requestId: { userId, requestId } },
        })
      )
        throw new ConflictException();
      const now = new Date();
      const { start, end } = this.quota.period(now);
      const used = await readAutomationUsage(tx, userId, start, end);
      const limit = PLAN_LIMITS.max.automationRuns;
      if (used >= limit && !scheduledFor)
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Đã hết lượt automation trong kỳ.',
            details: { limit, used, resetAt: end.toISOString() },
          },
          429,
        );
      const exhausted = used >= limit;
      const generation = exhausted
        ? null
        : await tx.generation.create({
            data: {
              userId,
              projectId,
              requestId,
              kind: 'AUTOMATION',
              input: {},
              briefSnapshot: {},
              requestedOutputs: 1,
              quotaUnits: 1,
              model: this.config.getOrThrow<string>('AI_MODEL'),
              createdAt: now,
            },
            select: { id: true },
          });
      const run = await tx.automationRun.create({
        data: {
          automationId: id,
          generationId: generation?.id,
          scheduledFor,
          trigger: scheduledFor ? 'schedule' : 'manual',
          status: exhausted ? 'skipped' : 'queued',
          finishedAt: exhausted ? now : null,
          summary: exhausted ? 'Đã hết quota tháng UTC.' : null,
          createdAt: now,
        },
      });
      await tx.automation.update({
        where: { id },
        data: {
          ...(scheduledFor
            ? { nextRunAt: nextRunAt(automationResponse(item).schedule, now) }
            : {}),
          lastRunAt: now,
        },
      });
      return runResponse(run);
    });
  }
  async runs(
    projectId: string,
    userId: string,
    id: string,
    query: AutomationRunsQuery,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, projectId);
      await this.owned(tx, id, projectId);
      const cursor = query.before
        ? await tx.automationRun.findFirst({
            where: { id: query.before, automationId: id },
          })
        : null;
      if (query.before && !cursor) throw new NotFoundException();
      const items = await tx.automationRun.findMany({
        where: {
          automationId: id,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      return {
        items: items.slice(0, query.limit).map(runResponse),
        hasMore: items.length > query.limit,
      };
    });
  }
  async pause(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      await pauseAutomations(tx, userId);
    });
  }
  async due(now: Date) {
    const items = await this.prisma.automation.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
        project: { deletedAt: null },
      },
      include: { project: { select: { ownerId: true } } },
      take: 100,
    });
    for (const item of items) {
      try {
        await this.reserve(
          item.projectId,
          item.project.ownerId,
          item.id,
          `schedule-${item.id}-${item.nextRunAt!.toISOString()}`,
          item.nextRunAt!,
        );
      } catch (error) {
        if (!(
          error instanceof NotFoundException ||
          error instanceof ConflictException
        ))
          throw error;
      }
    }
  }
}
