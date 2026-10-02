import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readTextUsage } from '../ai/quota.service';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}
  usage(userId: string, start: Date, end: Date) {
    return this.prisma.$transaction(
      async (tx) => {
        const projects = await tx.project.count({
          where: { ownerId: userId, deletedAt: null },
        });
        const text = await readTextUsage(tx, userId, start, end);
        return { projects, text: text.used };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
