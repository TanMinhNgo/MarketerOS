import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readAssistantUsage, readTextUsage } from '../ai/quota.service';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}
  usage(userId: string, start: Date, end: Date, includeAssistant = false) {
    return this.prisma.$transaction(
      async (tx) => {
        const projects = await tx.project.count({
          where: { ownerId: userId, deletedAt: null },
        });
        const text = await readTextUsage(tx, userId, start, end);
        const assistant = includeAssistant
          ? await readAssistantUsage(tx, userId, start, end)
          : undefined;
        return { projects, text: text.used, assistant };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
