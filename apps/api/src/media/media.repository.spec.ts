import { ConflictException, NotFoundException } from '@nestjs/common';
import { MediaRepository } from './media.repository';
import { QuotaService } from '../ai/quota.service';
import type { PrismaService } from '../prisma/prisma.service';

const input = { prompt: 'Campaign image', size: '1024x1024' as const };

function fixture(used: number, existing = false, project = true) {
  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ id: 'user' }])
      .mockResolvedValueOnce(project ? [{ id: 'project' }] : []),
    generation: {
      findUnique: jest.fn().mockResolvedValue(existing ? { id: 'old' } : null),
      count: jest.fn().mockResolvedValue(used),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
    },
  };
  const prisma = {
    $transaction: (fn: (client: unknown) => Promise<unknown>) => fn(tx),
  };
  const repository = new MediaRepository(
    prisma as unknown as PrismaService,
    new QuotaService(),
  );
  return { repository, tx };
}

test('IMAGE reservation serializes quota and counts failed/pending rows', async () => {
  const { repository, tx } = fixture(4);
  await expect(
    repository.reserve('project', 'user', 'request', input, {}, 'model', 5),
  ).resolves.toEqual({ id: 'new' });
  const countCalls = tx.generation.count.mock.calls as unknown as Array<
    [
      {
        where: {
          userId: string;
          kind: string;
          createdAt: { gte: Date; lt: Date };
        };
      },
    ]
  >;
  const counted = countCalls[0][0];
  expect(counted.where.userId).toBe('user');
  expect(counted.where.kind).toBe('IMAGE');
  expect(counted.where.createdAt.gte).toBeInstanceOf(Date);
  expect(counted.where.createdAt.lt).toBeInstanceOf(Date);
  const createCalls = tx.generation.create.mock.calls as unknown as Array<
    [
      {
        data: {
          kind: string;
          status: string;
          quotaUnits: number;
          requestedOutputs: number;
        };
      },
    ]
  >;
  const created = createCalls[0][0];
  expect(created.data).toMatchObject({
    kind: 'IMAGE',
    status: 'PENDING',
    quotaUnits: 1,
    requestedOutputs: 1,
  });
});

test('IMAGE reservation rejects duplicate key and exhausted quota before model call', async () => {
  const duplicate = fixture(0, true);
  await expect(
    duplicate.repository.reserve(
      'project',
      'user',
      'request',
      input,
      {},
      'model',
      5,
    ),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(duplicate.tx.generation.create).not.toHaveBeenCalled();
  const exhausted = fixture(5);
  await expect(
    exhausted.repository.reserve(
      'project',
      'user',
      'request',
      input,
      {},
      'model',
      5,
    ),
  ).rejects.toMatchObject({ status: 429 });
  expect(exhausted.tx.generation.create).not.toHaveBeenCalled();
});

test('IMAGE reservation rejects foreign or trashed project', async () => {
  const { repository, tx } = fixture(0, false, false);
  await expect(
    repository.reserve('project', 'user', 'request', input, {}, 'model', 5),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(tx.generation.create).not.toHaveBeenCalled();
});
