import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  ConnectionSchema,
  PublicationSchema,
  type PublicationsQuery,
} from '@marketos/shared';
import type { AuthUser } from '../auth/auth.decorators';
import { ClerkGateway } from '../auth/clerk.gateway';
import type {
  ChannelConnection,
  IntegrationOAuthSession,
  Publication,
  PublicationMetric,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationCrypto } from './integration-crypto';
import {
  ProviderGateway,
  type Provider,
  type ProviderPage,
  type TokenSet,
} from './provider.gateway';

type StoredCredential = { accessToken: string };
type PageSession = { pages: ProviderPage[]; expiresAt: string | null };
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const metricValue = (value: bigint | null) => value?.toString() ?? null;

export function connectionResponse(row: ChannelConnection) {
  return ConnectionSchema.parse({
    id: row.id,
    projectId: row.projectId,
    channel: row.channel,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    externalUrl: row.externalUrl,
    status: row.status,
    connectedAt: row.connectedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  });
}
export function publicationResponse(
  row: Publication & {
    connection: ChannelConnection;
    content?: { title: string } | null;
    metrics?: PublicationMetric[];
  },
) {
  const metric = row.metrics?.[0];
  const snapshot = row.payloadSnapshot as { title?: string };
  return PublicationSchema.parse({
    id: row.id,
    contentId: row.contentId,
    connectionId: row.connectionId,
    channel: row.connection.channel,
    status: row.status,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    externalUrl: row.externalUrl,
    errorCode: row.errorCode,
    title: snapshot.title ?? row.content?.title ?? '',
    latestMetric: metric
      ? {
          measuredAt: metric.measuredAt.toISOString(),
          impressions: metricValue(metric.impressions),
          reach: metricValue(metric.reach),
          clicks: metricValue(metric.clicks),
          likes: metricValue(metric.likes),
          comments: metricValue(metric.comments),
          shares: metricValue(metric.shares),
        }
      : null,
  });
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: IntegrationCrypto,
    private readonly providers: ProviderGateway,
    private readonly clerk: ClerkGateway,
  ) {}
  private async project(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId, deletedAt: null },
    });
    if (!project) throw new NotFoundException();
    return project;
  }
  private redirect(
    result: 'connected' | 'pick' | 'error',
    extra?: Record<string, string>,
  ) {
    const url = new URL(
      '/apps/integrations',
      this.config.getOrThrow<string>('WEB_URL'),
    );
    url.searchParams.set('result', result);
    for (const [key, value] of Object.entries(extra ?? {}))
      url.searchParams.set(key, value);
    return url.toString();
  }
  async list(projectId: string, userId: string) {
    await this.project(projectId, userId);
    await this.prisma.channelConnection.updateMany({
      where: { projectId, status: 'CONNECTED', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    const items = await this.prisma.channelConnection.findMany({
      where: {
        projectId,
        channel: { in: ['FACEBOOK', 'LINKEDIN'] },
        status: { in: ['CONNECTED', 'EXPIRED', 'ERROR'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items: items.map(connectionResponse) };
  }
  async start(projectId: string, user: AuthUser, provider: Provider) {
    await this.project(projectId, user.id);
    const channel = provider === 'facebook' ? 'FACEBOOK' : 'LINKEDIN';
    const existing = await this.prisma.channelConnection.findFirst({
      where: {
        projectId,
        channel,
        status: { notIn: ['REVOKED', 'DISCONNECTED'] },
      },
    });
    if (existing?.status === 'CONNECTED')
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Channel already connected.',
      });
    const nonce = randomUUID();
    const state = this.crypto.signState({
      userId: user.id,
      projectId,
      provider,
      nonce,
      issuedAt: Date.now(),
    });
    const authUrl = this.providers.authorize(provider, state);
    await this.prisma.integrationOAuthSession.create({
      data: {
        id: nonce,
        userId: user.id,
        projectId,
        provider,
        stateHash: hash(state),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    return { authUrl };
  }
  async callback(provider: Provider, state: string, code?: string) {
    let parsed: ReturnType<IntegrationCrypto['readState']>;
    try {
      parsed = this.crypto.readState(state);
    } catch {
      return this.redirect('error', { code: 'INVALID_STATE' });
    }
    if (parsed.provider !== provider || !code)
      return this.redirect('error', { code: 'INVALID_STATE' });
    const consumed = await this.prisma.integrationOAuthSession.updateMany({
      where: {
        id: parsed.nonce,
        stateHash: hash(state),
        userId: parsed.userId,
        projectId: parsed.projectId,
        provider,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date(), stateHash: null },
    });
    if (consumed.count !== 1)
      return this.redirect('error', { code: 'INVALID_STATE' });
    try {
      await this.project(parsed.projectId, parsed.userId);
      const owner = await this.prisma.user.findUnique({
        where: { id: parsed.userId },
        select: { clerkId: true },
      });
      if (
        !owner ||
        !(await this.clerk.channelPublishingEntitled(owner.clerkId))
      )
        return this.redirect('error', { code: 'PLAN_REQUIRED' });
      const token = await this.providers.exchange(provider, code);
      if (provider === 'linkedin') {
        const identity = await this.providers.linkedInIdentity(
          token.accessToken,
        );
        await this.connect(
          parsed.projectId,
          'LINKEDIN',
          identity.id,
          identity.name,
          identity.avatarUrl,
          null,
          token,
        );
        return this.redirect('connected');
      }
      const pages = await this.providers.facebookPages(token.accessToken);
      if (pages.length === 0)
        return this.redirect('error', { code: 'NO_PAGE' });
      if (pages.length === 1) {
        await this.connectPage(parsed.projectId, pages[0], token.expiresAt);
        return this.redirect('connected');
      }
      const session = randomUUID();
      await this.prisma.integrationOAuthSession.create({
        data: {
          id: session,
          userId: parsed.userId,
          projectId: parsed.projectId,
          provider,
          ciphertext: this.crypto.encrypt({
            pages,
            expiresAt: token.expiresAt,
          } satisfies PageSession),
          expiresAt: new Date(Date.now() + 600_000),
        },
      });
      return this.redirect('pick', { session });
    } catch {
      return this.redirect('error', { code: 'PROVIDER_ERROR' });
    }
  }
  private async connectPage(
    projectId: string,
    page: ProviderPage,
    expiresAt: string | null,
  ) {
    return this.connect(
      projectId,
      'FACEBOOK',
      page.id,
      page.name,
      page.avatarUrl,
      `https://www.facebook.com/${encodeURIComponent(page.id)}`,
      { accessToken: page.accessToken, expiresAt },
    );
  }
  private async connect(
    projectId: string,
    channel: 'FACEBOOK' | 'LINKEDIN',
    accountId: string,
    displayName: string,
    avatarUrl: string | null,
    externalUrl: string | null,
    token: TokenSet,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId} FOR UPDATE`;
      const active = await tx.channelConnection.findFirst({
        where: {
          projectId,
          channel,
          status: { notIn: ['REVOKED', 'DISCONNECTED'] },
        },
      });
      if (active && active.externalAccountId !== accountId)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Channel already connected.',
        });
      const row = await tx.channelConnection.upsert({
        where: {
          projectId_channel_externalAccountId: {
            projectId,
            channel,
            externalAccountId: accountId,
          },
        },
        create: {
          projectId,
          channel,
          externalAccountId: accountId,
          displayName,
          avatarUrl,
          externalUrl,
          status: 'CONNECTED',
          expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
        },
        update: {
          displayName,
          avatarUrl,
          externalUrl,
          status: 'CONNECTED',
          expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
          connectedAt: new Date(),
        },
      });
      await tx.integrationCredential.upsert({
        where: { connectionId: row.id },
        create: {
          connectionId: row.id,
          ciphertext: this.crypto.encrypt({
            accessToken: token.accessToken,
          } satisfies StoredCredential),
        },
        update: {
          ciphertext: this.crypto.encrypt({
            accessToken: token.accessToken,
          } satisfies StoredCredential),
        },
      });
      return connectionResponse(row);
    });
  }
  private async pageSession(
    projectId: string,
    userId: string,
    session: string,
  ): Promise<{ row: IntegrationOAuthSession; data: PageSession }> {
    const row = await this.prisma.integrationOAuthSession.findFirst({
      where: {
        id: session,
        projectId,
        userId,
        provider: 'facebook',
        expiresAt: { gt: new Date() },
        consumedAt: null,
        ciphertext: { not: null },
      },
    });
    if (!row?.ciphertext) throw new NotFoundException();
    return { row, data: this.crypto.decrypt<PageSession>(row.ciphertext) };
  }
  async pages(projectId: string, userId: string, session: string) {
    await this.project(projectId, userId);
    const { data } = await this.pageSession(projectId, userId, session);
    return {
      items: data.pages.map(({ id, name, avatarUrl }) => ({
        id,
        name,
        avatarUrl,
      })),
    };
  }
  async selectPage(
    projectId: string,
    userId: string,
    session: string,
    pageId: string,
  ) {
    await this.project(projectId, userId);
    const { data } = await this.pageSession(projectId, userId, session);
    const page = data.pages.find((item) => item.id === pageId);
    if (!page)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Page is not in OAuth session.',
      });
    const claimed = await this.prisma.integrationOAuthSession.updateMany({
      where: { id: session, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date(), ciphertext: null },
    });
    if (claimed.count !== 1)
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'OAuth session already used.',
      });
    return this.connectPage(projectId, page, data.expiresAt);
  }
  async disconnect(projectId: string, userId: string, id: string) {
    await this.project(projectId, userId);
    const row = await this.prisma.channelConnection.findFirst({
      where: { id, projectId, status: { notIn: ['REVOKED', 'DISCONNECTED'] } },
      include: { credential: true },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.publication.updateMany({
        where: { connectionId: id, status: 'QUEUED' },
        data: { status: 'CANCELLED' },
      });
      await tx.channelConnection.update({
        where: { id },
        data: { status: 'REVOKED', credentialRef: null },
      });
      await tx.integrationCredential.deleteMany({
        where: { connectionId: id },
      });
    });
    if (row.credential) {
      try {
        await this.providers.revoke(
          row.channel === 'FACEBOOK' ? 'facebook' : 'linkedin',
          this.crypto.decrypt<StoredCredential>(row.credential.ciphertext)
            .accessToken,
        );
      } catch {
        /* Local revocation is final even if provider is unavailable. */
      }
    }
  }
  async publish(
    projectId: string,
    userId: string,
    contentId: string,
    key: string,
  ) {
    await this.project(projectId, userId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${contentId} AND "projectId"=${projectId} FOR UPDATE`;
      const content = await tx.contentItem.findFirst({
        where: { id: contentId, projectId },
      });
      if (!content) throw new NotFoundException();
      const existing = await tx.publication.findFirst({
        where: {
          requestId: key,
          connection: { projectId, channel: content.channel },
        },
        include: {
          connection: true,
          metrics: { orderBy: { measuredAt: 'desc' }, take: 1 },
        },
      });
      if (existing) {
        if (existing.contentId !== contentId)
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Idempotency key belongs to another content.',
          });
        return publicationResponse(existing);
      }
      if (
        !['READY', 'SCHEDULED'].includes(content.status) ||
        !['FACEBOOK', 'LINKEDIN'].includes(content.channel)
      )
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Content is not approved for this channel.',
        });
      const connection = await tx.channelConnection.findFirst({
        where: { projectId, channel: content.channel, status: 'CONNECTED' },
      });
      if (!connection)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Channel is not connected.',
        });
      if (connection.expiresAt && connection.expiresAt <= new Date())
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Channel token expired.',
        });
      const inFlight = await tx.publication.count({
        where: { contentId, status: { in: ['QUEUED', 'PUBLISHING'] } },
      });
      if (inFlight)
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Content already has a publication in progress.',
        });
      let row;
      try {
        row = await tx.publication.create({
          data: {
            contentId,
            connectionId: connection.id,
            requestId: key,
            payloadSnapshot: {
              title: content.title,
              body: content.body,
              hashtags: content.hashtags,
              cta: content.cta,
            },
            status: 'QUEUED',
          },
          include: { connection: true, metrics: true },
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        )
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Content already has a publication in progress.',
          });
        throw error;
      }
      return publicationResponse(row);
    });
  }
  async publications(
    projectId: string,
    userId: string,
    query: PublicationsQuery,
  ) {
    await this.project(projectId, userId);
    const cursor = query.before
      ? await this.prisma.publication.findFirst({
          where: { id: query.before, connection: { projectId } },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.before && !cursor) throw new NotFoundException();
    const items = await this.prisma.publication.findMany({
      where: {
        connection: { projectId, channel: { in: ['FACEBOOK', 'LINKEDIN'] } },
        ...(query.contentId ? { contentId: query.contentId } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        connection: true,
        metrics: { orderBy: { measuredAt: 'desc' }, take: 1 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return {
      items: items.slice(0, query.limit).map(publicationResponse),
      hasMore: items.length > query.limit,
    };
  }
  async credential(connectionId: string): Promise<string> {
    const row = await this.prisma.integrationCredential.findUnique({
      where: { connectionId },
    });
    if (!row)
      throw new ServiceUnavailableException(
        'Integration credential unavailable',
      );
    return this.crypto.decrypt<StoredCredential>(row.ciphertext).accessToken;
  }
}
