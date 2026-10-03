import { Temporal } from '@js-temporal/polyfill';
import type { AutomationSchedule } from '@marketos/shared';

// One occurrence per local date. DST gaps shift forward; overlaps use the earlier instant.
export function nextRunAt(
  schedule: AutomationSchedule,
  after = new Date(),
): Date {
  const local = Temporal.Instant.fromEpochMilliseconds(
    after.getTime(),
  ).toZonedDateTimeISO(schedule.timezone);
  const [hour, minute] = schedule.time.split(':').map(Number);
  for (let offset = 0; offset <= 62; offset++) {
    const date = local.toPlainDate().add({ days: offset });
    if (
      schedule.frequency === 'weekly' &&
      !schedule.weekdays.includes(date.dayOfWeek % 7)
    )
      continue;
    if (schedule.frequency === 'monthly' && date.day !== schedule.dayOfMonth)
      continue;
    const candidate = date
      .toPlainDateTime({ hour, minute })
      .toZonedDateTime(schedule.timezone, { disambiguation: 'compatible' });
    if (candidate.epochMilliseconds > after.getTime())
      return new Date(candidate.epochMilliseconds);
  }
  throw new Error('Không tính được lần chạy tiếp theo.');
}

export function schedulingSlots(
  timezone: string,
  times: string[],
  daysAhead: number,
  now: Date,
): Date[] {
  const date = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDate();
  const slots = new Set<number>();
  for (let offset = 0; offset < daysAhead; offset++)
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      const instant = date
        .add({ days: offset })
        .toPlainDateTime({ hour, minute })
        .toZonedDateTime(timezone, { disambiguation: 'compatible' });
      if (instant.epochMilliseconds > now.getTime())
        slots.add(instant.epochMilliseconds);
    }
  return [...slots].sort((a, b) => a - b).map((value) => new Date(value));
}
