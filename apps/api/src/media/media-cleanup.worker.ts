import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaStorage } from './media.storage';

@Injectable()
export class MediaCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  async onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 60_000);
    await this.tick();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.mediaDeletion.findMany({
        orderBy: { id: 'asc' },
        take: 100,
      });
      for (const row of rows) {
        try {
          await this.storage.remove(row.storageKey); // NOSONAR: each durable object is deleted before its outbox row.
          await this.prisma.mediaDeletion.deleteMany({ where: { id: row.id } }); // NOSONAR: dequeue only after ImageKit confirms deletion.
        } catch {
          this.logger.warn('Media object cleanup will retry later.');
        }
      }
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
