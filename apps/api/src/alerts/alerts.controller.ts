import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OperationalAlertsResponseSchema } from '@marketos/shared';
import { INTEGRATION_PROVIDERS } from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { OwnershipGuard } from '../projects/ownership.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(OwnershipGuard)
@Controller('projects/:projectId/alerts')
export class AlertsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(OperationalAlertsResponseSchema) })
  async list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 10 * 60_000);
    const project = { id: projectId, ownerId: user.id, deletedAt: null };
    if (
      !(await this.prisma.project.findFirst({
        where: project,
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    const [publications, connections, runs, overdue] = await Promise.all([
      this.prisma.publication.findMany({
        where: {
          connection: { project },
          OR: [
            { status: 'FAILED' },
            { status: 'PUBLISHING', claimedAt: { lt: cutoff } },
            {
              status: 'QUEUED',
              createdAt: { lt: cutoff },
              OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lt: cutoff } }],
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: { id: true, status: true, errorCode: true, createdAt: true },
      }),
      this.prisma.channelConnection.findMany({
        where: {
          project,
          OR: [
            { status: { in: ['EXPIRED', 'REAUTH_REQUIRED', 'ERROR'] } },
            { status: 'CONNECTED', expiresAt: { lte: now } },
          ],
        },
        select: { id: true, updatedAt: true },
      }),
      this.prisma.automationRun.findMany({
        where: {
          automation: { project },
          OR: [
            { status: 'failed' },
            {
              status: { in: ['queued', 'running'] },
              createdAt: { lt: cutoff },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: { id: true, status: true, createdAt: true },
      }),
      this.prisma.contentItem.findMany({
        where: {
          projectId,
          project,
          status: 'SCHEDULED',
          scheduledAt: { lt: cutoff },
          publications: {
            none: {
              status: { in: ['QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED'] },
            },
          },
          OR: INTEGRATION_PROVIDERS.map(({ channel }) => ({
            channel,
            project: {
              ...project,
              channelConnections: { some: { channel, status: 'CONNECTED' } },
            },
          })),
        },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: user.features.includes('channel_publishing') ? 50 : 0,
        select: { id: true, scheduledAt: true },
      }),
    ]);
    return OperationalAlertsResponseSchema.parse({
      checkedAt: now.toISOString(),
      items: [
        ...overdue.map((row) => ({
          id: `content:${row.id}:${row.scheduledAt!.toISOString()}`,
          type: 'CONTENT_DELAYED',
          resourceId: row.id,
          message:
            'Bài đã quá lịch đăng hơn 10 phút nhưng chưa có tác vụ xuất bản. Kiểm tra worker.',
          errorCode: null,
          createdAt: row.scheduledAt!.toISOString(),
        })),
        ...publications.map((row) => ({
          id: `publication:${row.id}:${row.status}`,
          type:
            row.status === 'FAILED'
              ? 'PUBLICATION_FAILED'
              : 'PUBLICATION_DELAYED',
          resourceId: row.id,
          message:
            row.status === 'FAILED'
              ? 'Đăng bài thất bại. Kiểm tra lịch sử xuất bản trước khi thử lại.'
              : 'Bài đăng chưa hoàn tất sau 10 phút. Kiểm tra worker.',
          errorCode: row.errorCode,
          createdAt: row.createdAt.toISOString(),
        })),
        ...connections.map((row) => ({
          id: `connection:${row.id}:${row.updatedAt.toISOString()}`,
          type: 'CONNECTION_REAUTH',
          resourceId: row.id,
          message: 'Kết nối kênh cần kiểm tra hoặc đăng nhập lại.',
          errorCode: null,
          createdAt: row.updatedAt.toISOString(),
        })),
        ...runs.map((row) => ({
          id: `automation:${row.id}:${row.status}`,
          type:
            row.status === 'failed'
              ? 'AUTOMATION_FAILED'
              : 'AUTOMATION_DELAYED',
          resourceId: row.id,
          message:
            row.status === 'failed'
              ? 'Tác vụ tự động thất bại.'
              : 'Tác vụ tự động chưa hoàn tất sau 10 phút. Kiểm tra worker.',
          errorCode: null,
          createdAt: row.createdAt.toISOString(),
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }
}
