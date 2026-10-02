import { QuotaService, textUsage } from './quota.service';

test.each([
  [0, 0, 0],
  [0, 1, 1],
  [0, 2, 1],
  [0, 3, 1],
  [0, 4, 2],
  [2, 0, 2],
  [2, 1, 3],
  [2, 3, 3],
  [2, 4, 4],
])(
  'TEXT usage: %i ordinary units + %i regenerations = %i',
  (units, count, expected) => {
    expect(textUsage(units, count)).toBe(expected);
  },
);

test('uses confirmed TEXT limits and resets at a UTC month boundary', () => {
  const quota = new QuotaService();
  expect(quota.limit('free')).toBe(10);
  expect(quota.limit('pro')).toBe(200);
  expect(quota.period(new Date('2026-10-31T23:59:59Z'))).toEqual({
    start: new Date('2026-10-01T00:00:00Z'),
    end: new Date('2026-11-01T00:00:00Z'),
  });
});
