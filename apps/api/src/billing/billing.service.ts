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
    const counts = await this.billing.usage(user.id, start, end);
    const limits = PLAN_LIMITS[user.plan];
    return {
      plan: user.plan,
      features: user.features,
      period: { start: start.toISOString(), end: end.toISOString() },
      usage: {
        projects: { used: counts.projects, limit: limits.projects },
        text: { used: counts.text, limit: limits.text },
      },
    };
  }
}
