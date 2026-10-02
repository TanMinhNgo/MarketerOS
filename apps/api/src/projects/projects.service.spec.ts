import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

test('project mutations map missing rows to 404 and preserve other errors', async () => {
  const missing = new Prisma.PrismaClientKnownRequestError('missing', {
    code: 'P2025',
    clientVersion: 'test',
  });
  const repository = {
    update: jest.fn().mockRejectedValue(missing),
    trash: jest.fn().mockRejectedValue(missing),
    restore: jest.fn().mockRejectedValue(missing),
  };
  const service = new ProjectsService(
    repository as unknown as ProjectsRepository,
  );
  for (const operation of [
    () => service.update('project', 'owner', { name: 'Test' }),
    () => service.trash('project', 'owner'),
    () => service.restore('project', 'owner', 'free'),
  ]) {
    await expect(operation()).rejects.toBeInstanceOf(NotFoundException);
  }
  const unavailable = new Error('database unavailable');
  repository.update.mockRejectedValueOnce(unavailable);
  await expect(
    service.update('project', 'owner', { name: 'Test' }),
  ).rejects.toBe(unavailable);
});
