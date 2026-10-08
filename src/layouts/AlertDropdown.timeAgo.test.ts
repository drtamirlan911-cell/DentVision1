import { afterEach, describe, expect, it, vi } from 'vitest';
import { timeAgo } from './AlertDropdown';

describe('notification timeAgo', () => {
  afterEach(() => vi.useRealTimers());

  it('uses valid singular RelativeTimeFormat units', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T09:00:00Z'));
    expect(timeAgo('2026-10-08T08:59:45Z')).toBe('15 секунд назад');
    expect(timeAgo('2026-10-07T09:00:00Z')).toBe('вчера');
  });

  it('fails safely on malformed timestamps', () => {
    expect(timeAgo('not-a-date')).toBe('');
  });
});
