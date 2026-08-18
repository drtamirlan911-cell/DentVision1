import { describe, it, expect } from 'vitest';
import { formatDateValue } from './DatePicker';

describe('formatDateValue', () => {
  it('renders an ISO date as dd.mm.yyyy', () => {
    expect(formatDateValue('2026-08-17')).toBe('17.08.2026');
  });

  it('keeps leading zeros', () => {
    expect(formatDateValue('2026-01-05')).toBe('05.01.2026');
  });

  it('does not shift the day across timezones', () => {
    // new Date('2026-01-01') is UTC midnight, so a naive Date-based
    // implementation renders 31.12.2025 anywhere west of Greenwich.
    expect(formatDateValue('2026-01-01')).toBe('01.01.2026');
  });

  it('returns an empty string for an unset value', () => {
    expect(formatDateValue('')).toBe('');
    expect(formatDateValue(undefined)).toBe('');
    expect(formatDateValue(null)).toBe('');
  });

  it('returns an empty string for a partial or malformed value', () => {
    // A date input reports "" while the user is mid-edit, but defensive anyway.
    expect(formatDateValue('2026-08')).toBe('');
    expect(formatDateValue('17.08.2026')).toBe('');
    expect(formatDateValue(20260817)).toBe('');
  });

  it('tolerates surrounding whitespace', () => {
    expect(formatDateValue('  2026-08-17 ')).toBe('17.08.2026');
  });
});
