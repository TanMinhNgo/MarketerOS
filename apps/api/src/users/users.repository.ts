import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PlanKey } from '@marketos/shared';
import { pauseAutomations } from '../automation/automation-lifecycle';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  find(clerkId: string) {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }
  delete(clerkId: string) {
    return this.prisma.user.deleteMany({ where: { clerkId } });
  }
  syncPlan(userId: string, plan: PlanKey, hasAutomation: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      await tx.user.update({
        where: { id: userId },
        data: { billingPlan: plan },
      });
      if (plan !== 'max' || !hasAutomation) await pauseAutomations(tx, userId);
    });
  }
  upsert(
    clerkId: string,
    profile: { email: string | null; name: string | null },
  ) {
    return this.prisma.user.upsert({
      where: { clerkId },
      update: { clerkId },
      create: { clerkId, ...profile },
    });
  }
}
