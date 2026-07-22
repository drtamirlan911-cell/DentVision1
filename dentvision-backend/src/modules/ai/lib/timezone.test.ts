import { describe, expect, it } from 'vitest';
import {
  clientTimeZoneFromRequest,
  hourInTimeZone,
  resolveTimeZone,
  timeGreetingInTz,
  zonedDayRange,
  zonedLocalToUtc,
} from './timezone.js';

describe('clinic timezone helpers', () => {
  it('maps Almaty morning (UTC night) to Доброе утро', () => {
    // 2026-07-22 05:28 UTC = 10:28 Asia/Almaty
    const d = new Date('2026-07-22T05:28:00.000Z');
    expect(hourInTimeZone(d, 'Asia/Almaty')).toBe(10);
    expect(timeGreetingInTz(d, 'Asia/Almaty')).toBe('Доброе утро');
    // Same instant in UTC would look like "night"
    expect(timeGreetingInTz(d, 'UTC')).toBe('Доброй ночи');
  });

  it('builds day range in Asia/Almaty', () => {
    const d = new Date('2026-07-22T05:28:00.000Z');
    const { start, end, dateLabel } = zonedDayRange('Asia/Almaty', d);
    expect(start.toISOString()).toBe(zonedLocalToUtc('Asia/Almaty', 2026, 7, 22, 0, 0, 0).toISOString());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(dateLabel.toLowerCase()).toContain('22');
    expect(dateLabel.toLowerCase()).toContain('июл');
  });

  it('prefers client timezone over clinic default', () => {
    expect(resolveTimeZone('Europe/Moscow', 'Asia/Almaty')).toBe('Europe/Moscow');
    expect(
      clientTimeZoneFromRequest({
        headers: { 'x-client-timezone': 'Europe/Berlin' },
        body: { timezone: 'Asia/Almaty' },
      }),
    ).toBe('Europe/Berlin');
  });
});
