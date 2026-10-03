import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readAssistantUsage, readTextUsage } from '../ai/quota.service';
import { readAutomationUsage } from '../automation/automation.repository';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}
  usage(
    userId: string,
    start: Date,
    end: Date,
    includeAssistant = false,
    includeAutomation = false,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const projects = await tx.project.count({
          where: { ownerId: userId, deletedAt: null },
        });
        const text = await readTextUsage(tx, userId, start, end);
        const assistant = includeAssistant
          ? await readAssistantUsage(tx, userId, start, end)
          : undefined;
        const automationRuns = includeAutomation
          ? await readAutomationUsage(tx, userId, start, end)
          : undefined;
        const automations = includeAutomation
          ? await tx.automation.count({
              where: { enabled: true, project: { ownerId: userId } },
            })
          : undefined;
        return {
          projects,
          text: text.used,
          assistant,
          automationRuns,
          automations,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
