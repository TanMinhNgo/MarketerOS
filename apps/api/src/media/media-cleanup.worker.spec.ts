import type { PrismaService } from '../prisma/prisma.service';
import { MediaCleanupWorker } from './media-cleanup.worker';
import type { MediaStorage } from './media.storage';

test('cleanup dequeues only after ImageKit delete succeeds, then retries failures', async () => {
  const rows = [{ id: 1, storageKey: 'imagekit-file-id' }];
  const prisma = {
    mediaDeletion: {
      findMany: jest.fn().mockResolvedValue(rows),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const storage = {
    remove: jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined),
  };
  const worker = new MediaCleanupWorker(
    prisma as unknown as PrismaService,
    storage as unknown as MediaStorage,
  );
  await worker.tick();
  expect(prisma.mediaDeletion.deleteMany).not.toHaveBeenCalled();
  await worker.tick();
  expect(storage.remove).toHaveBeenCalledTimes(2);
  expect(prisma.mediaDeletion.deleteMany).toHaveBeenCalledWith({
    where: { id: 1 },
  });
});
