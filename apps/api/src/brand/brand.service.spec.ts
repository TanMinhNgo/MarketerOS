import { NotFoundException } from '@nestjs/common';
import { BrandRepository } from './brand.repository';
import { BrandService } from './brand.service';

test('missing brief is 404 and repository errors are preserved', async () => {
  const repository = {
    find: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
  };
  const service = new BrandService(repository as unknown as BrandRepository);
  await expect(service.get('project', 'owner')).rejects.toBeInstanceOf(
    NotFoundException,
  );
  const error = new Error('database unavailable');
  repository.find.mockRejectedValueOnce(error);
  await expect(service.get('project', 'owner')).rejects.toBe(error);
});
