import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiRepository } from './ai.repository';
import { QuotaService } from './quota.service';

test.each([10, 0])(
  'reservation crossing UTC month checks the new period (old usage %i)',
  async (oldUsage) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-31T23:59:59.999Z'));
    const reservedAt = new Date('2026-02-01T00:00:00.001Z');
    const newUsage = 10 - oldUsage;
    const aggregate = jest
      .fn()
      .mockImplementation((args: Prisma.GenerationAggregateArgs) => ({
        _sum: {
          quotaUnits:
            (args.where?.createdAt as { gte: Date }).gte.getUTCMonth() === 1
              ? newUsage
              : oldUsage,
        },
      }));
    const create = jest.fn().mockResolvedValue({ id: 'generation' });
    const tx = {
      $queryRaw: jest.fn().mockImplementation(() => {
        jest.setSystemTime(reservedAt);
        return Promise.resolve([{ id: 'project' }]);
      }),
      generation: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate,
        count: jest.fn().mockResolvedValue(0),
        create,
      },
    };
    const prisma = {
      $transaction: (run: (db: typeof tx) => Promise<unknown>) => run(tx),
    };
    const repo = new AiRepository(
      prisma as unknown as PrismaService,
      new QuotaService(),
    );
    try {
      const reservation = repo.reserve(
        'project',
        'user',
        'request',
        { channel: 'BLOG', goal: 'Test', topic: 'Test' },
        {},
        'test-model',
        10,
      );
      if (newUsage === 0) {
        await expect(reservation).resolves.toEqual({ id: 'generation' });
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ createdAt: reservedAt }) as unknown,
          }),
        );
      } else {
        await expect(reservation).rejects.toMatchObject({
          status: 429,
          response: {
            code: 'QUOTA_EXCEEDED',
            details: {
              used: 10,
              limit: 10,
              resetAt: '2026-03-01T00:00:00.000Z',
            },
          },
        });
        expect(create).not.toHaveBeenCalled();
      }
      expect(aggregate).toHaveBeenCalledWith({
        where: {
          userId: 'user',
          kind: 'TEXT',
          createdAt: {
            gte: new Date('2026-02-01T00:00:00Z'),
            lt: new Date('2026-03-01T00:00:00Z'),
          },
        },
        _sum: { quotaUnits: true },
      });
    } finally {
      jest.useRealTimers();
    }
  },
);
