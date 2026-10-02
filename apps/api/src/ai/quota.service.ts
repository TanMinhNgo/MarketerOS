import { Injectable } from '@nestjs/common';
import type { PlanKey } from '@marketos/shared';

type Kind = 'TEXT' | 'IMAGE';
export const textUsage = (quotaUnits: number, regenerations: number) =>
  quotaUnits + Math.ceil(regenerations / 3);
const limits: Record<PlanKey, Record<Kind, number>> = {
  free: { TEXT: 10, IMAGE: 2 },
  pro: { TEXT: 200, IMAGE: 50 },
};

@Injectable()
export class QuotaService {
  limit(plan: PlanKey, kind: Kind) {
    return limits[plan][kind];
  }

  period(now = new Date()) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
    };
  }
}
