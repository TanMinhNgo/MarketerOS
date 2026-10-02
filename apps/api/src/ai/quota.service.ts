import { Injectable } from '@nestjs/common';
import type { PlanKey } from '@marketos/shared';
import type { Prisma } from '../generated/prisma/client';
import { PLAN_LIMITS } from '../billing/plan-limits';

export const textUsage = (quotaUnits: number, regenerations: number) =>
  quotaUnits + Math.ceil(regenerations / 3);

export async function readTextUsage(
  db: Prisma.TransactionClient,
  userId: string,
  start: Date,
  end: Date,
) {
  const where = {
    userId,
    kind: 'TEXT' as const,
    createdAt: { gte: start, lt: end },
  };
  const usage = await db.generation.aggregate({
    where,
    _sum: { quotaUnits: true },
  });
  // ponytail: TEXT/1 denotes regeneration; add a discriminator before other single-output TEXT flows.
  const regenerations = await db.generation.count({
    where: { ...where, requestedOutputs: 1 },
  });
  const units = usage._sum.quotaUnits ?? 0;
  return { units, regenerations, used: textUsage(units, regenerations) };
}

@Injectable()
export class QuotaService {
  limit(plan: PlanKey) {
    return PLAN_LIMITS[plan].text;
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
