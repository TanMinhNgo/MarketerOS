import { Injectable } from '@nestjs/common';
import type { BillingUsageResponse } from '@marketos/shared';
import type { AuthUser } from '../auth/auth.decorators';
import { QuotaService } from '../ai/quota.service';
import { BillingRepository } from './billing.repository';
import { PLAN_LIMITS } from './plan-limits';

@Injectable()
export class BillingService {
  constructor(
    private readonly billing: BillingRepository,
    private readonly quota: QuotaService,
  ) {}
  async usage(user: AuthUser): Promise<BillingUsageResponse> {
    const { start, end } = this.quota.period();
    const includeAssistant =
      user.plan !== 'free' && user.features.includes('ai_assistant');
    const includeAutomation =
      user.plan === 'max' && user.features.includes('automation');
    const counts = await this.billing.usage(
      user.id,
      start,
      end,
      includeAssistant,
      includeAutomation,
    );
    const limits = PLAN_LIMITS[user.plan];
    return {
      plan: user.plan,
      features: user.features,
      period: { start: start.toISOString(), end: end.toISOString() },
      usage: {
        projects: { used: counts.projects, limit: limits.projects },
        text: { used: counts.text, limit: limits.text },
        images: { used: counts.images, limit: limits.images },
        ...(includeAssistant
          ? {
              assistant: {
                used: counts.assistant!,
                limit:
                  user.plan === 'max'
                    ? PLAN_LIMITS.max.assistant
                    : PLAN_LIMITS.pro.assistant,
              },
            }
          : {}),
        ...(includeAutomation
          ? {
              automationRuns: {
                used: counts.automationRuns!,
                limit: PLAN_LIMITS.max.automationRuns,
              },
              automations: {
                used: counts.automations!,
                limit: PLAN_LIMITS.max.automations,
              },
            }
          : {}),
      },
    };
  }
}
