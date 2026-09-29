import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, executeRaw } = vi.hoisted(() => ({ queryRaw: vi.fn(), executeRaw: vi.fn() }));
vi.mock('./prisma.js', () => ({ default: { $queryRaw: queryRaw, $executeRaw: executeRaw } }));
const { clearDaily, counterKeys, incrementDaily, readDaily, utcDay } = await import('./dailyCounter.js');

beforeEach(() => { queryRaw.mockReset(); executeRaw.mockReset(); });

describe('PostgreSQL daily counter', () => {
  it('increments and returns durable total', async () => { queryRaw.mockResolvedValue([{ total: 7 }]); await expect(incrementDaily('k', 3)).resolves.toBe(7); });
  it('returns null on persistence failure', async () => { queryRaw.mockRejectedValue(new Error('database down')); await expect(incrementDaily('k')).resolves.toBeNull(); });
  it('reads zero for absent counter', async () => { queryRaw.mockResolvedValue([]); await expect(readDaily('k')).resolves.toBe(0); });
  it('returns null on read failure', async () => { queryRaw.mockRejectedValue(new Error('database down')); await expect(readDaily('k')).resolves.toBeNull(); });
  it('clearing never throws', async () => { executeRaw.mockRejectedValue(new Error('database down')); await expect(clearDaily('k')).resolves.toBeUndefined(); });
});

describe('keys', () => {
  it('carry the day', () => expect(counterKeys.guestQuota('u1', '2026-08-29')).not.toBe(counterKeys.guestQuota('u1', '2026-08-30')));
  it('separate counters and users', () => { const d='2026-08-29'; const k=[counterKeys.modelBudget('mini',d),counterKeys.modelBudget('full',d),counterKeys.guestQuota('u1',d),counterKeys.guestQuota('u2',d),counterKeys.patientQuota('u1',d)]; expect(new Set(k).size).toBe(k.length); });
  it('uses UTC calendar days', () => { expect(utcDay(new Date('2026-08-29T23:59:59Z'))).toBe('2026-08-29'); expect(utcDay(new Date('2026-08-30T00:00:01Z'))).toBe('2026-08-30'); });
});