import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export class SchemaPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Dữ liệu không hợp lệ.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    return result.data;
  }
}
