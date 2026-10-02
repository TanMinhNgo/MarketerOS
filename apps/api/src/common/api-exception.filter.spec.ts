import type { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ApiExceptionFilter } from './api-exception.filter';

test('only database availability errors become 503; other failures remain safe 500', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const filter = new ApiExceptionFilter();
  for (const code of [
    'P1000',
    'P1001',
    'P1002',
    'P1008',
    'P1017',
    'P2024',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'P2002',
  ]) {
    filter.catch(
      new Prisma.PrismaClientKnownRequestError('secret', {
        code,
        clientVersion: 'test',
      }),
      host,
    );
    expect(status).toHaveBeenLastCalledWith(code === 'P2002' ? 500 : 503);
    expect(JSON.stringify(json.mock.calls.at(-1))).not.toContain('secret');
  }
  filter.catch(new Error('secret-programming-error'), host);
  expect(status).toHaveBeenLastCalledWith(500);
  expect(json).toHaveBeenLastCalledWith({
    code: 'INTERNAL',
    message: 'Dịch vụ hiện không khả dụng.',
    details: null,
  });
});
