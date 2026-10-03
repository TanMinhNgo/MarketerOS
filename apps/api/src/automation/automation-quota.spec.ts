import { readAutomationUsage } from './automation.repository';
import type { Prisma } from '../generated/prisma/client';
import { QuotaService } from '../ai/quota.service';

test('monthly automation quota counts its immutable ledger across all statuses', async () => {
  const { start, end } = new QuotaService().period(
    new Date('2026-12-31T23:59:59Z'),
  );
  const count = jest.fn().mockResolvedValue(60);
  expect(
    await readAutomationUsage(
      { generation: { count } } as unknown as Prisma.TransactionClient,
      'owner',
      start,
      end,
    ),
  ).toBe(60);
  expect(count).toHaveBeenCalledWith({
    where: {
      userId: 'owner',
      kind: 'AUTOMATION',
      createdAt: { gte: start, lt: end },
    },
  });
  expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
});
