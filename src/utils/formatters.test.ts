import { describe, it, expect } from 'vitest';
import { fd, ft } from './formatters';

describe('fd', () => {
  it('formats a plain YYYY-MM-DD date', () => {
    expect(fd('2026-08-17')).toBe('17.08.2026');
  });

  it('formats a full ISO timestamp without leaking the time component', () => {
    // Regression: previously rendered "17T09:10:00.000Z.08.2026" because the
    // raw string was split on "-" before the time was removed.
    expect(fd('2026-08-17T09:10:00.000Z')).toBe('17.08.2026');
  });

  it('formats an ISO timestamp with a timezone offset', () => {
    expect(fd('2026-01-05T23:45:00+06:00')).toBe('05.01.2026');
  });

  it('returns an empty string for empty input', () => {
    expect(fd('')).toBe('');
  });

  it('returns the input unchanged when it is not a parseable date', () => {
    expect(fd('не дата')).toBe('не дата');
  });
});

describe('ft', () => {
  it('trims seconds off a time string', () => {
    expect(ft('09:30:00')).toBe('09:30');
  });

  it('passes through HH:mm unchanged', () => {
    expect(ft('14:05')).toBe('14:05');
  });

  it('returns an empty string for empty input', () => {
    expect(ft('')).toBe('');
  });
});
