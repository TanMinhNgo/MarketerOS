import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AssistantActionSchema,
  AssistantApplyResponseSchema,
  ReplaceContentAssetsSchema,
  UpsertBrandBriefSchema,
  type AssistantAction,
} from '@marketos/shared';
import type { AuthUser } from '../auth/auth.decorators';
import { requireFeature } from '../auth/require-feature';
import { BrandRepository } from '../brand/brand.repository';
import { ContentRepository } from '../content/content.repository';
import type {
  AssistantActionExecution,
  Prisma,
} from '../generated/prisma/client';
import { MediaRepository } from '../media/media.repository';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';

const conflict = (message: string) =>
  new ConflictException({ code: 'CONFLICT', message, details: null });
const result = (row: AssistantActionExecution) =>
  AssistantApplyResponseSchema.parse({
    actionId: row.actionId,
    status: row.status,
    contentId: row.contentId,
    assetId: row.assetId,
    errorCode: row.errorCode,
    updatedAt: row.updatedAt.toISOString(),
  });

@Injectable()
export class AssistantApplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contents: ContentRepository,
    private readonly brand: BrandRepository,
    private readonly assets: MediaRepository,
    private readonly media: MediaService,
  ) {}

  private async lock(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Project" WHERE id=${projectId} AND "ownerId"=${userId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
  }
  private async action(
    tx: Prisma.TransactionClient,
    projectId: string,
    messageId: string,
    actionId: string,
  ) {
    const message = await tx.assistantMessage.findFirst({
      where: { id: messageId, projectId, role: 'assistant' },
    });
    if (!message) throw new NotFoundException();
    const actions = AssistantActionSchema.array().parse(message.actions);
    const action = actions.find((item) => item.id === actionId);
    if (!action) throw new NotFoundException();
    return { action, actions };
  }
  async get(
    projectId: string,
    userId: string,
    messageId: string,
    actionId: string,
  ) {
    const message = await this.prisma.assistantMessage.findFirst({
      where: {
        id: messageId,
        projectId,
        role: 'assistant',
        project: { ownerId: userId, deletedAt: null },
      },
    });
    if (!message) throw new NotFoundException();
    const action = AssistantActionSchema.array()
      .parse(message.actions)
      .find((item) => item.id === actionId);
    if (!action) throw new NotFoundException();
    const row = await this.prisma.assistantActionExecution.findUnique({
      where: { messageId_actionId: { messageId, actionId } },
    });
    return row
      ? result(row)
      : {
          actionId,
          status:
            action.status === 'applied'
              ? ('applied' as const)
              : ('pending' as const),
          contentId: null,
          assetId: null,
          errorCode: null,
          updatedAt: message.createdAt.toISOString(),
        };
  }
  async apply(
    projectId: string,
    user: AuthUser,
    messageId: string,
    actionId: string,
  ) {
    const lease = randomUUID();
    const claimed = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, projectId, user.id);
      const { action } = await this.action(tx, projectId, messageId, actionId);
      const existing = await tx.assistantActionExecution.findUnique({
        where: { messageId_actionId: { messageId, actionId } },
      });
      if (existing?.status === 'applied') return { action, row: existing };
      if (action.status !== 'proposed')
        throw conflict('Action không còn ở trạng thái proposed.');
      if (this.imageInput(action)) requireFeature(user, 'image_generation');
      if (action.type === 'update_brief') requireFeature(user, 'brand_brief');
      if (action.type === 'schedule') requireFeature(user, 'content_calendar');
      if (
        existing?.lease &&
        existing.updatedAt.getTime() > Date.now() - 5 * 60_000
      )
        throw conflict('Apply đang được xử lý.');
      const row = await tx.assistantActionExecution.upsert({
        where: { messageId_actionId: { messageId, actionId } },
        create: {
          messageId,
          actionId,
          imageRequestId: randomUUID(),
          status: 'running',
          lease,
        },
        update: { status: 'running', lease, errorCode: null },
      });
      return { action, row };
    });
    if (claimed.row.status === 'applied') return result(claimed.row);
    try {
      let row = await this.base(
        projectId,
        user.id,
        claimed.row,
        claimed.action,
        lease,
      );
      const image = this.imageInput(claimed.action);
      if (image && !row.assetId) {
        const previous = await this.prisma.generation.findUnique({
          where: {
            userId_requestId: {
              userId: user.id,
              requestId: row.imageRequestId,
            },
          },
          include: { assets: { select: { id: true, projectId: true } } },
        });
        // ponytail: unknown/failed provider attempts need a new user-reviewed action; never repeat a charge automatically.
        if (
          previous &&
          (previous.status !== 'SUCCEEDED' ||
            previous.assets.length !== 1 ||
            previous.assets[0].projectId !== projectId)
        )
          throw conflict(
            'Lượt tạo ảnh trước chưa có kết quả an toàn để tiếp tục. Kiểm tra thư viện và tạo đề xuất mới nếu cần.',
          );
        const assetId = previous
          ? previous.assets[0].id
          : (
              await this.media.generate(
                projectId,
                user,
                row.imageRequestId,
                image,
              )
            ).id;
        const saved = await this.prisma.assistantActionExecution.updateMany({
          where: { id: row.id, lease },
          data: { assetId },
        });
        if (!saved.count) throw conflict('Apply đã bị hủy hoặc thay đổi.');
        row = { ...row, assetId };
      }
      return await this.complete(
        projectId,
        user.id,
        row,
        claimed.action,
        lease,
      );
    } catch (error) {
      await this.prisma.assistantActionExecution.updateMany({
        where: { id: claimed.row.id, lease },
        data: { status: 'partial', lease: null, errorCode: 'APPLY_INCOMPLETE' },
      });
      throw error;
    }
  }
  private imageInput(action: AssistantAction) {
    if (action.type === 'generate_image')
      return { prompt: action.prompt, size: action.size, name: action.name };
    if (
      (action.type === 'create_draft' || action.type === 'edit_content') &&
      action.imagePrompt
    )
      return { prompt: action.imagePrompt, size: '1024x1024' as const };
    return null;
  }
  private base(
    projectId: string,
    userId: string,
    row: AssistantActionExecution,
    action: AssistantAction,
    lease: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, projectId, userId);
      const current = await tx.assistantActionExecution.findFirst({
        where: { id: row.id, lease },
      });
      if (!current) throw conflict('Apply đã bị hủy hoặc thay đổi.');
      if (current.baseDone) return current;
      const target =
        'contentId' in action
          ? action.contentId
          : action.type === 'generate_image'
            ? action.attachToContentId
            : undefined;
      const content = target
        ? await tx.contentItem.findFirst({
            where: { id: target, projectId },
            include: { assets: { orderBy: { position: 'asc' } } },
          })
        : null;
      if (target && !content) throw new NotFoundException();
      if (content?.status === 'DONE' && action.type !== 'schedule')
        throw conflict('Bài đã hoàn tất không thể sửa.');
      let contentId = target ?? null;
      let updatedAt = content?.updatedAt ?? null;
      let targetAssetIds: string[] = [];
      const proposedIds = 'assetIds' in action ? (action.assetIds ?? []) : [];
      const replace =
        action.type === 'attach_media'
          ? action.mode === 'replace'
          : action.type === 'edit_content' && action.assetMode === 'replace';
      const hasMedia =
        this.imageInput(action) ||
        ('assetIds' in action && action.assetIds !== undefined);
      if (hasMedia) {
        targetAssetIds = [
          ...new Set([
            ...(replace
              ? []
              : (content?.assets.map((link) => link.assetId) ?? [])),
            ...proposedIds,
          ]),
        ];
        if (
          targetAssetIds.length + Number(Boolean(this.imageInput(action))) >
          10
        )
          throw conflict('Tối đa 10 ảnh mỗi bài.');
        if (
          (await tx.asset.count({
            where: { projectId, id: { in: targetAssetIds } },
          })) !== targetAssetIds.length
        )
          throw new NotFoundException('Asset không thuộc dự án.');
      }
      if (action.type === 'create_draft') {
        const created = await this.contents.create(
          projectId,
          userId,
          {
            channel: action.channel,
            title: action.title,
            body: action.body,
            hashtags: action.hashtags,
            cta: action.cta,
            generationId: null,
          },
          tx,
        );
        contentId = created.id;
        updatedAt = created.updatedAt;
      } else if (action.type === 'edit_content') {
        const changes = {
          ...(action.title !== undefined ? { title: action.title } : {}),
          ...(action.body !== undefined ? { body: action.body } : {}),
          ...(action.hashtags !== undefined
            ? { hashtags: action.hashtags }
            : {}),
          ...(action.cta !== undefined ? { cta: action.cta } : {}),
        };
        if (Object.keys(changes).length)
          updatedAt = (
            await this.contents.update(
              projectId,
              userId,
              action.contentId,
              changes,
              tx,
            )
          ).updatedAt;
      } else if (action.type === 'schedule') {
        if (content?.status !== 'READY')
          throw conflict('Chỉ lên lịch bài READY.');
        if (new Date(action.scheduledAt) <= new Date())
          throw conflict('Giờ đăng phải nằm trong tương lai.');
        updatedAt = (
          await this.contents.update(
            projectId,
            userId,
            action.contentId,
            { status: 'SCHEDULED', scheduledAt: action.scheduledAt },
            tx,
          )
        ).updatedAt;
      } else if (action.type === 'update_brief') {
        const brief = await tx.brandBrief.findUnique({ where: { projectId } });
        if (!brief) throw new NotFoundException();
        await this.brand.upsert(
          projectId,
          userId,
          UpsertBrandBriefSchema.parse({
            product: brief.product,
            audience: brief.audience,
            tone: brief.tone,
            language: brief.language,
            businessAddress: brief.businessAddress,
            keyMessages: brief.keyMessages,
            avoidWords: brief.avoidWords,
            samplePosts: brief.samplePosts,
            visualStyle: brief.visualStyle,
            brandColors: brief.brandColors,
            ...action.changes,
          }),
          tx,
        );
      }
      return tx.assistantActionExecution.update({
        where: { id: row.id },
        data: {
          baseDone: true,
          contentId,
          contentUpdatedAt: updatedAt,
          targetAssetIds,
        },
      });
    });
  }
  private complete(
    projectId: string,
    userId: string,
    row: AssistantActionExecution,
    action: AssistantAction,
    lease: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, projectId, userId);
      const current = await tx.assistantActionExecution.findFirst({
        where: { id: row.id, lease },
      });
      if (!current) throw conflict('Apply đã bị hủy hoặc thay đổi.');
      const { actions, action: stored } = await this.action(
        tx,
        projectId,
        row.messageId,
        row.actionId,
      );
      if (stored.status !== 'proposed') throw conflict('Action đã thay đổi.');
      const hasMedia =
        this.imageInput(action) ||
        ('assetIds' in action && action.assetIds !== undefined);
      if (row.contentId && hasMedia) {
        const content = await tx.contentItem.findFirst({
          where: { id: row.contentId, projectId },
        });
        if (!content) throw new NotFoundException();
        if (content.updatedAt.getTime() !== row.contentUpdatedAt?.getTime())
          throw conflict(
            'Bài đã được sửa sau khi Apply bắt đầu. Kiểm tra bài và ảnh đã tạo trước khi tiếp tục.',
          );
        await this.assets.replaceContentAssets(
          projectId,
          userId,
          row.contentId,
          ReplaceContentAssetsSchema.parse({
            assetIds: [
              ...row.targetAssetIds,
              ...(row.assetId ? [row.assetId] : []),
            ],
          }),
          tx,
        );
      }
      stored.status = 'applied';
      await tx.assistantMessage.update({
        where: { id: row.messageId },
        data: { actions },
      });
      return result(
        await tx.assistantActionExecution.update({
          where: { id: row.id },
          data: { status: 'applied', lease: null, errorCode: null },
        }),
      );
    });
  }
}
