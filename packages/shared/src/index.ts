import { z } from 'zod';

export * from './errors';
export * from './core';
export * from './plans';
export * from './billing';
export * from './assistant';
export * from './content';
export * from './automation';
export * from './integrations';
export * from './media';
export * from './references';
export * from './alerts';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
