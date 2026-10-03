import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { ClerkGateway } from '../auth/clerk.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from './integrations.service';
import { ProviderError, ProviderGateway } from './provider.gateway';

export function scheduledRequestId(
  contentId: string,
  scheduledAt: Date,
): string {
  return `${contentId}:${scheduledAt.toISOString()}`;
}
export function isPublishable(
  status: string,
  scheduledAt: Date | null,
  now: Date,
): boolean {
  return status === 'SCHEDULED' && scheduledAt !== null && scheduledAt <= now;
}

@Injectable()
export class PublicationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationWorker.name);
  private queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopping = false;
  private scanCursor?: { scheduledAt: Date; id: string };
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly provider: ProviderGateway,
    private readonly clerk: ClerkGateway,
  ) {}
  async onModuleInit() {
    const url = new URL(this.config.getOrThrow<string>('REDIS_URL'));
    const connection: ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue('marketos-publication', { connection });
    this.worker = new Worker(
      'marketos-publication',
      (job) => this.execute(String(job.id)),
      { connection, concurrency: 2, maxStalledCount: 1 },
    );
    this.worker.on('error', () =>
      this.logger.error('Publication Redis connection unavailable.'),
    );
    this.timer = setInterval(() => {
      void this.tick();
    }, 5000);
    await this.tick();
  }
  async tick() {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      await this.prisma.integrationOAuthSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await this.recoverAmbiguous();
      await this.reserveScheduled();
      const queued = await this.prisma.publication.findMany({
        where: {
          status: 'QUEUED',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const row of queued) {
        const previous = await this.queue!.getJob(row.id); // NOSONAR: inspect the job before dispatching this publication.
        const state = previous && (await previous.getState()); // NOSONAR: removal must precede re-adding the same job ID.
        if (previous && ['completed', 'failed'].includes(state ?? ''))
          await previous.remove(); // NOSONAR: re-dispatch follows removal.
        await this.queue!.add(
          'publish',
          {},
          {
            jobId: row.id,
            attempts: 1,
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 3600 },
          },
        ); // NOSONAR: dispatch in creation order.
      }
      await this.syncMetrics();
    } catch {
      this.logger.error('Publication scheduler unavailable; will retry.');
    } finally {
      this.ticking = false;
    }
  }
  async reserveScheduled() {
    const now = new Date();
    const due = await this.prisma.contentItem.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
        AND: [
          {
            OR: [
              {
                channel: 'FACEBOOK',
                project: {
                  deletedAt: null,
                  channelConnections: {
                    some: { channel: 'FACEBOOK', status: 'CONNECTED' },
                  },
                },
              },
              {
                channel: 'LINKEDIN',
                project: {
                  deletedAt: null,
                  channelConnections: {
                    some: { channel: 'LINKEDIN', status: 'CONNECTED' },
                  },
                },
              },
            ],
          },
          ...(this.scanCursor
            ? [
                {
                  OR: [
                    { scheduledAt: { gt: this.scanCursor.scheduledAt } },
                    {
                      scheduledAt: this.scanCursor.scheduledAt,
                      id: { gt: this.scanCursor.id },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const last = due.at(-1);
    this.scanCursor =
      due.length === 100 && last?.scheduledAt
        ? { scheduledAt: last.scheduledAt, id: last.id }
        : undefined;
    for (const content of due) {
      if (!isPublishable(content.status, content.scheduledAt, now)) continue;
      const connection = await this.prisma.channelConnection.findFirst({
        where: {
          projectId: content.projectId,
          channel: content.channel,
          status: 'CONNECTED',
        },
      }); // NOSONAR: each content has its own connection and dispatch order.
      if (!connection) continue;
      const inFlight = await this.prisma.publication.count({
        where: {
          contentId: content.id,
          status: { in: ['QUEUED', 'PUBLISHING', 'PUBLISHED'] },
        },
      }); // NOSONAR: check before reserving this content.
      if (inFlight) continue;
      try {
        await this.prisma.publication.create({
          data: {
            contentId: content.id,
            connectionId: connection.id,
            requestId: scheduledRequestId(content.id, content.scheduledAt!),
            scheduledAt: content.scheduledAt,
            payloadSnapshot: {
              title: content.title,
              body: content.body,
              hashtags: content.hashtags,
              cta: content.cta,
            },
            status: 'QUEUED',
          },
        }); // NOSONAR: preserve due order; unique requestId makes retries idempotent.
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        )
          continue;
        throw error;
      }
    }
  }
  private async recoverAmbiguous() {
    const stale = new Date(Date.now() - 5 * 60_000);
    // A crashed worker may have posted externally. Never resend without reconciliation.
    await this.prisma.publication.updateMany({
      where: { status: 'PUBLISHING', claimedAt: { lt: stale } },
      data: { status: 'FAILED', errorCode: 'PROVIDER_ERROR' },
    });
  }
  async execute(id: string) {
    const claimed = await this.prisma.publication.updateMany({
      where: {
        id,
        status: 'QUEUED',
        attempts: { lt: 3 },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      data: {
        status: 'PUBLISHING',
        attempts: { increment: 1 },
        claimedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return;
    const row = await this.prisma.publication.findUnique({
      where: { id },
      include: {
        connection: { include: { project: { include: { owner: true } } } },
        content: true,
      },
    });
    if (!row) return;
    const fail = async (
      code:
        | 'TOKEN_EXPIRED'
        | 'PERMISSION_DENIED'
        | 'RATE_LIMITED'
        | 'CONTENT_REJECTED'
        | 'PROVIDER_ERROR',
      retry = false,
    ) => {
      await this.prisma.publication.update({
        where: { id },
        data: {
          status: retry && row.attempts < 3 ? 'QUEUED' : 'FAILED',
          errorCode: code,
          claimedAt: null,
          nextAttemptAt:
            retry && row.attempts < 3
              ? new Date(Date.now() + 2 ** row.attempts * 30_000)
              : null,
        },
      });
      if (code === 'TOKEN_EXPIRED')
        await this.prisma.channelConnection.updateMany({
          where: { id: row.connectionId, status: 'CONNECTED' },
          data: { status: 'EXPIRED' },
        });
    };
    const connection = row.connection;
    if (
      connection.project.deletedAt ||
      connection.status !== 'CONNECTED' ||
      (connection.expiresAt && connection.expiresAt <= new Date())
    ) {
      await fail(
        connection.expiresAt && connection.expiresAt <= new Date()
          ? 'TOKEN_EXPIRED'
          : 'PERMISSION_DENIED',
      );
      return;
    }
    if (
      !row.content ||
      !['READY', 'SCHEDULED'].includes(row.content.status) ||
      row.content.channel !== connection.channel
    ) {
      await fail('CONTENT_REJECTED');
      return;
    }
    if (
      row.scheduledAt &&
      !isPublishable(row.content.status, row.scheduledAt, new Date())
    ) {
      await fail('CONTENT_REJECTED');
      return;
    }
    try {
      if (
        !(await this.clerk.channelPublishingEntitled(
          connection.project.owner.clerkId,
        ))
      ) {
        await fail('PERMISSION_DENIED');
        return;
      }
      const token = await this.integrations.credential(connection.id);
      const snapshot = row.payloadSnapshot as {
        body?: string;
        hashtags?: string[];
        cta?: string | null;
      };
      const body = [
        snapshot.body,
        snapshot.hashtags
          ?.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
          .join(' '),
        snapshot.cta,
      ]
        .filter(Boolean)
        .join('\n\n');
      if (!snapshot.body?.trim()) {
        await fail('CONTENT_REJECTED');
        return;
      }
      const result = await this.provider.publish(
        connection.channel as 'FACEBOOK' | 'LINKEDIN',
        connection.externalAccountId,
        token,
        body,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.publication.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            externalPostId: result.id,
            externalUrl: result.url,
            errorCode: null,
            claimedAt: null,
          },
        });
        await tx.contentItem.updateMany({
          where: {
            id: row.contentId ?? '',
            projectId: connection.projectId,
            status: { in: ['READY', 'SCHEDULED'] },
          },
          data: { status: 'DONE' },
        });
      });
    } catch (error) {
      if (error instanceof ProviderError)
        await fail(error.code, error.retryable && !error.ambiguous);
      else await fail('PROVIDER_ERROR');
    }
  }
  async syncMetrics() {
    const threshold = new Date(Date.now() - 6 * 3600_000);
    const recent = new Date(Date.now() - 30 * 24 * 3600_000);
    const connections = await this.prisma.channelConnection.findMany({
      where: {
        channel: 'FACEBOOK',
        status: 'CONNECTED',
        project: { deletedAt: null },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: threshold } }],
      },
      include: { project: { include: { owner: true } } },
    });
    for (const connection of connections) {
      try {
        if (
          !(await this.clerk.channelPublishingEntitled(
            connection.project.owner.clerkId,
          ))
        ) {
          await this.prisma.channelConnection.update({
            where: { id: connection.id },
            data: { lastSyncedAt: new Date() },
          });
          continue;
        }
        const token = await this.integrations.credential(connection.id);
        const measuredAt = new Date();
        let cursor: string | undefined;
        for (;;) {
          const publications = await this.prisma.publication.findMany({
            where: {
              connectionId: connection.id,
              status: 'PUBLISHED',
              publishedAt: { gte: recent },
              externalPostId: { not: null },
            },
            orderBy: { id: 'asc' },
            take: 100,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          }); // NOSONAR: next page follows the cursor from this batch.
          for (const publication of publications) {
            const values = await this.provider.facebookMetrics(
              publication.externalPostId!,
              token,
            ); // NOSONAR: sequential to respect provider rate limits.
            await this.prisma.publicationMetric.create({
              data: { publicationId: publication.id, measuredAt, ...values },
            }); // NOSONAR: persist after this provider response.
          }
          if (publications.length < 100) break;
          cursor = publications.at(-1)!.id;
        }
        await this.prisma.channelConnection.update({
          where: { id: connection.id },
          data: { lastSyncedAt: measuredAt },
        }); // NOSONAR: sync watermark advances after batch commits.
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'TOKEN_EXPIRED')
          await this.prisma.channelConnection.update({
            where: { id: connection.id },
            data: { status: 'EXPIRED' },
          });
      }
    }
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
