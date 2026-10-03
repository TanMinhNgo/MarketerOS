import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationRepository } from './automation.repository';
import { AutomationExecutor } from './automation.executor';

@Injectable()
export class AutomationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationWorker.name);
  private queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;
  private ticking = false;
  private stopping = false;
  private lastErrorAt = 0;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly repository: AutomationRepository,
    private readonly executor: AutomationExecutor,
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
    this.queue = new Queue('marketos-automation', { connection });
    this.worker = new Worker(
      'marketos-automation',
      (job) => this.executor.execute(String(job.id)),
      { connection, concurrency: 2, maxStalledCount: 1 },
    );
    this.queue.on('error', () => this.reportError());
    this.worker.on('error', () => this.reportError());
    this.worker.on('failed', () =>
      this.logger.warn(
        'Automation job failed; durable DB state controls recovery.',
      ),
    );
    this.timer = setInterval(() => {
      void this.tick();
    }, 5000);
    await this.tick();
    this.logger.log('Automation worker started; scheduler/outbox interval 5s.');
  }
  async tick() {
    if (this.ticking || this.stopping) return;
    this.ticking = true;
    try {
      await this.executor.recoverStale();
      await this.executor.reconcileDueEntitlements();
      await this.repository.due(new Date());
      const queued = await this.prisma.automationRun.findMany({
        where: { status: 'queued' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const run of queued) {
        const previous = await this.queue!.getJob(run.id); // NOSONAR: dispatch follows createdAt order.
        // A provider/Clerk/Redis error before DB claim may retry dispatch; claimed runs never call model twice.
        const state = previous && (await previous.getState()); // NOSONAR: check state before re-adding the job ID.
        if (state === 'failed' && previous) await previous.remove(); // NOSONAR: removal precedes re-addition of the same job ID.
        const options = {
          jobId: run.id,
          attempts: 1,
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 86400 },
        };
        await this.queue!.add('run', {}, options); // NOSONAR: finish dispatch before the next run.
      }
    } catch {
      this.logger.error(
        'Automation scheduler/outbox unavailable; will retry next tick.',
      );
    } finally {
      this.ticking = false;
    }
  }
  private reportError() {
    if (Date.now() - this.lastErrorAt < 30_000) return;
    this.lastErrorAt = Date.now();
    this.logger.error(
      'Automation Redis connection unavailable; check Redis and worker configuration.',
    );
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
