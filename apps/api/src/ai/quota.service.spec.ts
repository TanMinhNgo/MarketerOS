import { QuotaService } from './quota.service';

test('keeps TEXT and IMAGE limits separate and resets at a UTC month boundary', () => {
  const quota = new QuotaService();
  expect(quota.limit('free', 'TEXT')).toBe(10);
  expect(quota.limit('free', 'IMAGE')).toBe(2);
  expect(quota.limit('pro', 'TEXT')).toBe(200);
  expect(quota.limit('pro', 'IMAGE')).toBe(50);
  expect(quota.period(new Date('2026-10-31T23:59:59Z'))).toEqual({
    start: new Date('2026-10-01T00:00:00Z'),
    end: new Date('2026-11-01T00:00:00Z'),
  });
});
