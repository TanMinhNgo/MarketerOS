import { Injectable, NotFoundException } from '@nestjs/common';
import { textReferences } from '../references/references.service';
import {
  ContentLanguageSchema,
  type AssistantAction,
  type Automation,
  type CreateAutomationInput,
} from '@marketos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkGateway } from '../auth/clerk.gateway';
import {
  AutomationRepository,
  automationResponse,
} from './automation.repository';
import { AssistantService } from '../assistant/assistant.service';
import { PromptBuilder, type BriefForPrompt } from '../ai/prompt-builder';
import { validateVariants } from '../ai/variant-validator';
import type { Prisma } from '../generated/prisma/client';
import { schedulingSlots } from './automation-schedule';

type Output = {
  content: string;
  actions: AssistantAction[];
  tokensIn: number | null;
  tokensOut: number | null;
};

@Injectable()
export class AutomationExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: AutomationRepository,
    private readonly clerk: ClerkGateway,
    private readonly assistant: AssistantService,
    private readonly prompts: PromptBuilder,
  ) {}
  async execute(runId: string) {
    const initial = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: {
        automation: { include: { project: { include: { owner: true } } } },
      },
    });
    if (initial?.status !== 'queued') return;
    const { project } = initial.automation;
    if (!(await this.clerk.automationEntitled(project.owner.clerkId))) {
      await this.repository.pause(project.ownerId);
      return;
    }
    const claimed = await this.prisma.$transaction(async (tx) => {
      try {
        await this.repository.lock(tx, project.ownerId, project.id);
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
      const run = await tx.automationRun.findUnique({
        where: { id: runId },
        include: { automation: true },
      });
      if (run?.status !== 'queued') return null;
      const brief = await tx.brandBrief.findUnique({
        where: { projectId: project.id },
      });
      if (!run.automation.enabled || !brief || !run.generationId) {
        await this.complete(
          tx,
          runId,
          run.generationId,
          'skipped',
          !brief ? 'Thiếu Brand Brief.' : 'Tác vụ đã tạm dừng.',
        );
        return null;
      }
      await tx.automationRun.update({
        where: { id: runId },
        data: { status: 'running', startedAt: new Date() },
      });
      const contents = await tx.contentItem.findMany({
        where: { projectId: project.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
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
      });
      const history = await tx.assistantMessage.findMany({
        where: { projectId: project.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: {
          id: true,
          role: true,
          content: true,
          actions: true,
          createdAt: true,
          automationId: true,
        },
      });
      return {
        run,
        brief,
        context: {
          references: await textReferences(tx, project.id, project.ownerId),
          generationId: run.generationId,
          project: { name: project.name, brandBrief: brief },
          contents,
          history: history.reverse(),
          userMessage: {
            id: run.id,
            role: 'user',
            content: '',
            actions: [],
            createdAt: run.createdAt,
            automationId: run.automationId,
          },
        },
      };
    });
    if (!claimed) {
      // A project moved to Trash after enqueue: never leave its jobs pending forever.
      await this.skipUnavailable(runId);
      return;
    }
    const automation = automationResponse(claimed.run.automation);
    const signal = AbortSignal.timeout(180_000);
    try {
      let output: Output = {
        content: '',
        actions: [],
        tokensIn: null,
        tokensOut: null,
      };
      const brief: BriefForPrompt = {
        ...claimed.brief,
        language: ContentLanguageSchema.parse(claimed.brief.language),
      };
      if (
        automation.type === 'custom_prompt' ||
        automation.type === 'write_posts'
      ) {
        const instructions =
          automation.type === 'write_posts'
            ? this.writeInstructions(automation, brief)
            : undefined;
        claimed.context.userMessage.content =
          automation.type === 'custom_prompt'
            ? automation.prompt
            : 'Đề xuất các bản nháp theo yêu cầu write_posts.';
        output = await this.assistant.automationReply(
          claimed.context,
          project.id,
          project.ownerId,
          signal,
          instructions,
        );
        if (automation.type === 'write_posts')
          this.validateWrite(output.actions, automation, brief);
      }
      // Refresh entitlement after a potentially long model call, before any effects are persisted.
      if (!(await this.clerk.automationEntitled(project.owner.clerkId))) {
        await this.repository.pause(project.ownerId);
        await this.finishSkipped(
          runId,
          project.ownerId,
          project.id,
          'Không còn quyền Max automation.',
        );
        return;
      }
      await this.prisma.$transaction((tx) =>
        this.saveResult(
          tx,
          runId,
          project.id,
          project.ownerId,
          automation,
          output,
        ),
      );
    } catch {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "AutomationRun" WHERE id=${runId} FOR UPDATE`;
        const run = await tx.automationRun.findUnique({ where: { id: runId } });
        if (run?.status !== 'running') return;
        await this.complete(
          tx,
          runId,
          run.generationId,
          'failed',
          'Không hoàn thành tác vụ. Không tự retry model.',
        );
      });
    }
  }

  private async saveResult(
    tx: Prisma.TransactionClient,
    runId: string,
    projectId: string,
    ownerId: string,
    automation: Automation,
    output: Output,
  ) {
    await this.repository.lock(tx, ownerId, projectId);
    await tx.$queryRaw`SELECT id FROM "AutomationRun" WHERE id=${runId} FOR UPDATE`;
    const current = await tx.automationRun.findUnique({
      where: { id: runId },
      include: { automation: true },
    });
    if (current?.status !== 'running') return;
    const latestBrief = await tx.brandBrief.findUnique({
      where: { projectId },
    });
    if (!latestBrief) {
      await this.complete(
        tx,
        runId,
        current.generationId,
        'skipped',
        'Thiếu Brand Brief.',
      );
      return;
    }
    this.validateCurrentBrief(output.actions, {
      ...latestBrief,
      language: ContentLanguageSchema.parse(latestBrief.language),
    });
    if (!current.automation.enabled) {
      await this.complete(
        tx,
        runId,
        current.generationId,
        'skipped',
        'Tác vụ đã tạm dừng.',
      );
      return;
    }
    const effects = await this.applyEffects(tx, projectId, automation, output);
    let assistantMessageId: string | null = null;
    if (
      automation.type === 'custom_prompt' ||
      automation.type === 'weekly_report'
    ) {
      const message = await tx.assistantMessage.create({
        data: {
          projectId,
          generationId: current.generationId!,
          automationId: automation.id,
          role: 'assistant',
          content: effects.summary,
          actions: output.actions,
        },
      });
      assistantMessageId = message.id;
    }
    await this.complete(
      tx,
      runId,
      current.generationId,
      'succeeded',
      effects.summary,
    );
    await tx.automationRun.update({
      where: { id: runId },
      data: {
        createdContentIds: effects.createdContentIds,
        scheduledContentIds: effects.scheduledContentIds,
        assistantMessageId,
      },
    });
    await tx.generation.updateMany({
      where: { id: current.generationId!, kind: 'AUTOMATION' },
      data: { tokensIn: output.tokensIn, tokensOut: output.tokensOut },
    });
  }

  private validateCurrentBrief(
    actions: AssistantAction[],
    brief: BriefForPrompt,
  ) {
    for (const action of actions) {
      if (action.type !== 'create_draft') continue;
      const errors = validateVariants(
        [
          {
            title: action.title,
            body: action.body,
            hashtags: action.hashtags,
            cta: action.cta ?? '',
          },
        ],
        action.channel,
        brief.avoidWords,
        brief.businessAddress,
        brief.language,
        1,
      );
      if (errors.length) throw new Error('Brief changed or draft invalid');
    }
  }

  private async applyEffects(
    tx: Prisma.TransactionClient,
    projectId: string,
    automation: Automation,
    output: Output,
  ) {
    const createdContentIds: string[] = [];
    let scheduledContentIds: string[] = [];
    let summary = output.content;
    if (automation.type === 'schedule_ready') {
      scheduledContentIds = await this.scheduleReady(tx, projectId, automation);
      summary = `Đã lên lịch ${scheduledContentIds.length} bài đã duyệt.`;
    } else if (automation.type === 'weekly_report') {
      summary = await this.weeklyReport(tx, projectId);
    } else {
      createdContentIds.push(
        ...(await this.createDrafts(tx, projectId, output.actions)),
      );
    }
    if (automation.type === 'write_posts')
      summary = `Đã tạo ${createdContentIds.length} bài DRAFT chờ duyệt.`;
    return { createdContentIds, scheduledContentIds, summary };
  }

  private async weeklyReport(tx: Prisma.TransactionClient, projectId: string) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const done = await tx.contentItem.count({
      where: { projectId, status: 'DONE', updatedAt: { gte: since } },
    });
    const scheduled = await tx.contentItem.count({
      where: { projectId, status: 'SCHEDULED' },
    });
    const drafts = await tx.contentItem.count({
      where: { projectId, status: 'DRAFT' },
    });
    return `Báo cáo 7 ngày: ${done} bài được đánh dấu Done trong kỳ; ${scheduled} bài đang lên lịch; ${drafts} bài đang chờ duyệt. Done là trạng thái do người dùng ghi nhận, không xác minh đã đăng ngoài hệ thống.`;
  }

  private async createDrafts(
    tx: Prisma.TransactionClient,
    projectId: string,
    actions: AssistantAction[],
  ) {
    const ids: string[] = [];
    for (const action of actions) {
      if (action.type !== 'create_draft') continue;
      const content = await this.createDraft(tx, projectId, action); // NOSONAR: preserve action order.
      ids.push(content.id);
      delete action.imagePrompt; // The applied automation action must describe only persisted effects.
      action.status = 'applied';
    }
    return ids;
  }

  private async createDraft(
    tx: Prisma.TransactionClient,
    projectId: string,
    action: Extract<AssistantAction, { type: 'create_draft' }>,
  ) {
    const assetIds = action.assetIds ?? [];
    if (assetIds.length) {
      const count = await tx.asset.count({
        where: { projectId, id: { in: assetIds } },
      });
      if (count !== assetIds.length)
        throw new Error('Invalid automation media asset');
    }
    const content = await tx.contentItem.create({
      data: {
        projectId,
        channel: action.channel,
        title: action.title,
        body: action.body,
        hashtags: action.hashtags,
        cta: action.cta,
        status: 'DRAFT',
        scheduledAt: null,
      },
    });
    if (assetIds.length)
      await tx.contentAsset.createMany({
        data: assetIds.map((assetId, position) => ({
          contentId: content.id,
          assetId,
          position,
        })),
      });
    // imagePrompt is intentionally ignored: automation never spends IMAGE quota.
    return content;
  }

  private writeInstructions(
    automation: Extract<CreateAutomationInput, { type: 'write_posts' }>,
    brief: BriefForPrompt,
  ) {
    const instructions = Array.from(
      { length: automation.count },
      (_, index) => {
        const channel = automation.channels[index % automation.channels.length];
        const prompt = this.prompts.build(
          {
            channel,
            goal: 'Tạo bản nháp marketing chờ người dùng duyệt',
            topic: automation.topic || 'Giới thiệu sản phẩm theo Brand Brief',
          },
          brief,
          { others: [] },
        );
        return { index, channel, ...prompt };
      },
    );
    const escapedInstructions = JSON.stringify(instructions).replaceAll(
      '<',
      '\\u003c',
    );
    return {
      system: `Đây là write_posts: trả đúng ${automation.count} actions create_draft theo thứ tự kênh của từng yêu cầu. Không action khác. Mỗi yêu cầu bên dưới dùng luật PromptBuilder của kênh. Không gọi tool.`,
      prompt: `<write_requests>${escapedInstructions}</write_requests>`,
    };
  }
  private validateWrite(
    actions: AssistantAction[],
    automation: Extract<CreateAutomationInput, { type: 'write_posts' }>,
    brief: BriefForPrompt,
  ) {
    if (actions.length !== automation.count)
      throw new Error('Incorrect draft count');
    for (const [index, action] of actions.entries()) {
      if (
        action.type !== 'create_draft' ||
        action.channel !==
          automation.channels[index % automation.channels.length]
      )
        throw new Error('Invalid automation action/channel');
      const errors = validateVariants(
        [
          {
            title: action.title,
            body: action.body,
            hashtags: action.hashtags,
            cta: action.cta ?? '',
          },
        ],
        action.channel,
        brief.avoidWords,
        brief.businessAddress,
        brief.language,
        1,
      );
      if (errors.length) throw new Error('Invalid generated draft');
    }
  }
  private async scheduleReady(
    tx: Prisma.TransactionClient,
    projectId: string,
    automation: Extract<CreateAutomationInput, { type: 'schedule_ready' }>,
  ) {
    const slots = schedulingSlots(
      automation.schedule.timezone,
      automation.times,
      automation.daysAhead,
      new Date(),
    );
    const existing = await tx.contentItem.findMany({
      where: { projectId, scheduledAt: { in: slots } },
      select: { scheduledAt: true },
    });
    const occupied = new Set(
      existing.map((item) => item.scheduledAt!.getTime()),
    );
    const available = slots.filter((slot) => !occupied.has(slot.getTime()));
    const contents = await tx.contentItem.findMany({
      where: {
        projectId,
        status: 'READY',
        scheduledAt: null,
        ...(automation.channels
          ? { channel: { in: automation.channels } }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: available.length,
    });
    const ids: string[] = [];
    for (const [index, content] of contents.entries()) {
      const slot = available[index];
      const changed = await this.assignSlot(tx, content.id, projectId, slot); // NOSONAR: retain slot order under project lock.
      if (changed.count) ids.push(content.id);
    }
    return ids;
  }
  private assignSlot(
    tx: Prisma.TransactionClient,
    contentId: string,
    projectId: string,
    at: Date,
  ) {
    return tx.contentItem.updateMany({
      where: { id: contentId, projectId, status: 'READY', scheduledAt: null },
      data: { status: 'SCHEDULED', scheduledAt: at },
    });
  }
  private async complete(
    tx: Prisma.TransactionClient,
    id: string,
    generationId: string | null,
    status: 'succeeded' | 'failed' | 'skipped',
    summary: string,
  ) {
    await tx.automationRun.update({
      where: { id },
      data: {
        status,
        summary,
        finishedAt: new Date(),
        ...(status === 'failed'
          ? {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: summary,
                details: null,
              },
            }
          : {}),
      },
    });
    if (generationId) {
      const generationStatus = {
        succeeded: 'SUCCEEDED',
        failed: 'FAILED',
        skipped: 'CANCELLED',
      } as const;
      await tx.generation.updateMany({
        where: { id: generationId, status: 'PENDING', kind: 'AUTOMATION' },
        data: {
          status: generationStatus[status],
          completedOutputs: status === 'succeeded' ? 1 : 0,
          completedAt: new Date(),
          errorCode:
            status === 'succeeded'
              ? null
              : 'AUTOMATION_' + status.toUpperCase(),
        },
      });
    }
  }
  private async finishSkipped(
    runId: string,
    userId: string,
    projectId: string,
    summary: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "AutomationRun" WHERE id=${runId} FOR UPDATE`;
      const run = await tx.automationRun.findUnique({ where: { id: runId } });
      if (run && ['queued', 'running'].includes(run.status))
        await this.complete(tx, runId, run.generationId, 'skipped', summary);
    });
  }
  private async skipUnavailable(runId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AutomationRun" WHERE id=${runId} FOR UPDATE`;
      const run = await tx.automationRun.findUnique({ where: { id: runId } });
      if (run?.status === 'queued')
        await this.complete(
          tx,
          runId,
          run.generationId,
          'skipped',
          'Dự án hoặc tác vụ không còn khả dụng.',
        );
    });
  }
  async recoverStale() {
    // A crash after claiming is failed rather than calling the model again. Committed effects are atomic.
    const runs = await this.prisma.automationRun.findMany({
      where: {
        status: 'running',
        startedAt: { lt: new Date(Date.now() - 300_000) },
      },
      take: 100,
    });
    for (const run of runs) {
      await this.failStaleRun(run); // NOSONAR: row-lock transactions run in order to bound DB load.
    }
  }
  private failStaleRun(run: { id: string; generationId: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AutomationRun" WHERE id=${run.id} FOR UPDATE`;
      const changed = await tx.automationRun.updateMany({
        where: { id: run.id, status: 'running' },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          summary: 'Worker bị gián đoạn. Không chạy lại model.',
        },
      });
      if (changed.count && run.generationId)
        await tx.generation.updateMany({
          where: { id: run.generationId, status: 'PENDING' },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorCode: 'WORKER_INTERRUPTED',
          },
        });
    });
  }
  async reconcileDueEntitlements() {
    const items = await this.prisma.automation.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: new Date() },
        project: { deletedAt: null },
      },
      include: { project: { include: { owner: true } } },
      take: 100,
    });
    const owners = new Map(
      items.map((item) => [item.project.ownerId, item.project.owner.clerkId]),
    );
    for (const [userId, clerkId] of owners) {
      const entitled = await this.clerk.automationEntitled(clerkId); // NOSONAR: bound Clerk requests.
      if (!entitled) await this.repository.pause(userId); // NOSONAR: pause follows the entitlement check for this user.
    }
  }
}
