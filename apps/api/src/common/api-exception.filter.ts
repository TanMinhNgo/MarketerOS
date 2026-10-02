import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ApiErrorSchema,
  type ApiError,
  type ErrorCode,
} from '@marketos/shared';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';

const statusCodes: Record<number, ErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};
const databaseUnavailableCodes = [
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
];

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception instanceof Prisma.PrismaClientKnownRequestError &&
              databaseUnavailableCodes.includes(exception.code)) ||
            (exception instanceof Prisma.PrismaClientInitializationError &&
              databaseUnavailableCodes.includes(exception.errorCode ?? ''))
          ? 503
          : 500;
    const original =
      exception instanceof HttpException ? exception.getResponse() : null;
    const parsed = ApiErrorSchema.safeParse(original);
    const body: ApiError =
      parsed.success && status < 500
        ? parsed.data
        : {
            code: statusCodes[status] ?? 'INTERNAL',
            message:
              status >= 500
                ? 'Dịch vụ hiện không khả dụng.'
                : 'Yêu cầu không hợp lệ.',
            details: null,
          };
    if (status >= 500) this.logger.error(`Request failed with HTTP ${status}`);
    response.status(status).json(body);
  }
}
