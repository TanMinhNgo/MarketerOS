import { z } from 'zod';
import { ChannelSchema } from './content';
import { ApiErrorSchema } from './errors';

const id = z.string().min(1).max(100);
export const AutomationTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const timezone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    if (/^[+-]/.test(value)) return false;
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Múi giờ IANA không hợp lệ.');
const commonSchedule = { time: AutomationTimeSchema, timezone };
export const AutomationScheduleSchema = z.discriminatedUnion('frequency', [
  z.object({ ...commonSchedule, frequency: z.literal('daily') }).strict(),
  z
    .object({
      ...commonSchedule,
      frequency: z.literal('weekly'),
      weekdays: z
        .array(z.number().int().min(0).max(6))
        .min(1)
        .max(7)
        .refine(unique),
    })
    .strict(),
  z
    .object({
      ...commonSchedule,
      frequency: z.literal('monthly'),
      dayOfMonth: z.number().int().min(1).max(28),
    })
    .strict(),
]);
export type AutomationSchedule = z.infer<typeof AutomationScheduleSchema>;
const channels = z.array(ChannelSchema).min(1).max(5).refine(unique);
const schedulingChannels = z.array(ChannelSchema).min(1).max(7).refine(unique);
const fields = {
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  schedule: AutomationScheduleSchema,
};
const write = z
  .object({
    ...fields,
    type: z.literal('write_posts'),
    channels,
    count: z.number().int().min(1).max(5),
    topic: z.string().trim().max(500).optional(),
  })
  .strict();
const scheduleReady = z
  .object({
    ...fields,
    type: z.literal('schedule_ready'),
    times: z.array(AutomationTimeSchema).min(1).max(3).refine(unique),
    daysAhead: z.number().int().min(1).max(14),
    channels: schedulingChannels.optional(),
  })
  .strict();
const report = z
  .object({ ...fields, type: z.literal('weekly_report') })
  .strict();
const custom = z
  .object({
    ...fields,
    type: z.literal('custom_prompt'),
    prompt: z.string().trim().min(1).max(2000),
  })
  .strict();
export const CreateAutomationSchema = z.discriminatedUnion('type', [
  write,
  scheduleReady,
  report,
  custom,
]);
export type CreateAutomationInput = z.infer<typeof CreateAutomationSchema>;
// Type is immutable. The backend merges this patch into the stored discriminated union.
export const UpdateAutomationSchema = z
  .object({
    name: fields.name.optional(),
    enabled: z.boolean().optional(),
    schedule: fields.schedule.optional(),
    channels: schedulingChannels.optional(),
    count: write.shape.count.optional(),
    topic: write.shape.topic,
    times: scheduleReady.shape.times.optional(),
    daysAhead: scheduleReady.shape.daysAhead.optional(),
    prompt: custom.shape.prompt.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Cần ít nhất một thay đổi.',
  );
export type UpdateAutomationInput = z.infer<typeof UpdateAutomationSchema>;
const persisted = {
  id,
  projectId: id,
  nextRunAt: z.iso.datetime().nullable(),
  lastRunAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};
export const AutomationSchema = z.discriminatedUnion('type', [
  write.extend(persisted),
  scheduleReady.extend(persisted),
  report.extend(persisted),
  custom.extend(persisted),
]);
export type Automation = z.infer<typeof AutomationSchema>;
export const AutomationRunSchema = z
  .object({
    id,
    automationId: id,
    trigger: z.enum(['schedule', 'manual']),
    status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped']),
    createdAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    finishedAt: z.iso.datetime().nullable(),
    summary: z.string().max(12000).nullable(),
    createdContentIds: z.array(id),
    scheduledContentIds: z.array(id),
    assistantMessageId: id.nullable(),
    error: ApiErrorSchema.nullable(),
  })
  .strict();
export type AutomationRun = z.infer<typeof AutomationRunSchema>;
export const AutomationsResponseSchema = z
  .object({ items: z.array(AutomationSchema) })
  .strict();
export type AutomationsResponse = z.infer<typeof AutomationsResponseSchema>;
export const AutomationRunsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    before: id.optional(),
  })
  .strict();
export type AutomationRunsQuery = z.infer<typeof AutomationRunsQuerySchema>;
export const AutomationRunsResponseSchema = z
  .object({ items: z.array(AutomationRunSchema), hasMore: z.boolean() })
  .strict();
export type AutomationRunsResponse = z.infer<
  typeof AutomationRunsResponseSchema
>;
