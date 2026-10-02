import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';

export const apiSchema = (
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): SchemaObject =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
