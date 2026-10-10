import { z } from 'zod';

export const OperationalAlertSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      'PUBLICATION_FAILED',
      'CONNECTION_REAUTH',
      'PUBLICATION_DELAYED',
      'CONTENT_DELAYED',
      'AUTOMATION_FAILED',
      'AUTOMATION_DELAYED',
    ]),
    resourceId: z.string(),
    message: z.string(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const OperationalAlertsResponseSchema = z
  .object({
    items: z.array(OperationalAlertSchema),
    checkedAt: z.iso.datetime(),
  })
  .strict();
