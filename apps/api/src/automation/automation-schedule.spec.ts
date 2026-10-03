import { nextRunAt, schedulingSlots } from './automation-schedule';
import {
  AutomationScheduleSchema,
  CreateAutomationSchema,
  UpdateAutomationSchema,
} from '@marketos/shared';

test.each([
  ['2026-03-07T08:00:00Z', '2026-03-08T07:30:00.000Z'],
  ['2026-03-08T07:30:00Z', '2026-03-09T06:30:00.000Z'],
])(
  'daily DST gap shifts forward and returns to local time next day',
  (after, expected) => {
    expect(
      nextRunAt(
        { frequency: 'daily', time: '02:30', timezone: 'America/New_York' },
        new Date(after),
      ).toISOString(),
    ).toBe(expected);
  },
);
test('DST overlap runs once per date, at the earlier instant', () => {
  const schedule = {
    frequency: 'daily' as const,
    time: '01:30',
    timezone: 'America/New_York',
  };
  expect(
    nextRunAt(schedule, new Date('2026-10-31T06:00:00Z')).toISOString(),
  ).toBe('2026-11-01T05:30:00.000Z');
  expect(
    nextRunAt(schedule, new Date('2026-11-01T05:30:00Z')).toISOString(),
  ).toBe('2026-11-02T06:30:00.000Z');
});
test('weekly Sunday=0 and multiple weekdays follow the IANA calendar', () => {
  expect(
    nextRunAt(
      {
        frequency: 'weekly',
        weekdays: [0, 2],
        time: '09:00',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      new Date('2026-10-03T12:00:00Z'),
    ).toISOString(),
  ).toBe('2026-10-04T02:00:00.000Z');
});
test('monthly schedule crosses year and February safely', () => {
  const schedule = {
    frequency: 'monthly' as const,
    dayOfMonth: 28,
    time: '10:00',
    timezone: 'UTC',
  };
  expect(
    nextRunAt(schedule, new Date('2026-12-28T10:00:00Z')).toISOString(),
  ).toBe('2027-01-28T10:00:00.000Z');
  expect(
    nextRunAt(schedule, new Date('2027-01-28T10:00:00Z')).toISOString(),
  ).toBe('2027-02-28T10:00:00.000Z');
});
test('content slots are future-only, sorted, and deduplicated across a DST gap', () => {
  const slots = schedulingSlots(
    'America/New_York',
    ['03:30', '02:30'],
    2,
    new Date('2026-03-08T06:00:00Z'),
  );
  expect(slots.map((slot) => slot.toISOString())).toEqual([
    '2026-03-08T07:30:00.000Z',
    '2026-03-09T06:30:00.000Z',
    '2026-03-09T07:30:00.000Z',
  ]);
});
test('strict schedules/config reject invalid timezones, incompatible fields and model privileges', () => {
  expect(
    AutomationScheduleSchema.safeParse({
      frequency: 'daily',
      time: '24:00',
      timezone: 'UTC',
    }).success,
  ).toBe(false);
  expect(
    AutomationScheduleSchema.safeParse({
      frequency: 'weekly',
      weekdays: [],
      time: '09:00',
      timezone: 'Mars/Olympus',
    }).success,
  ).toBe(false);
  expect(
    AutomationScheduleSchema.safeParse({
      frequency: 'monthly',
      dayOfMonth: 29,
      time: '09:00',
      timezone: 'UTC',
    }).success,
  ).toBe(false);
  expect(
    AutomationScheduleSchema.safeParse({
      frequency: 'daily',
      time: '09:00',
      timezone: 'UTC',
      weekdays: [1],
    }).success,
  ).toBe(false);
  expect(
    CreateAutomationSchema.safeParse({
      type: 'write_posts',
      name: 'x',
      enabled: true,
      schedule: { frequency: 'daily', time: '09:00', timezone: 'UTC' },
      channels: ['FACEBOOK'],
      count: 6,
    }).success,
  ).toBe(false);
  expect(
    UpdateAutomationSchema.safeParse({ type: 'weekly_report' }).success,
  ).toBe(false);
});
