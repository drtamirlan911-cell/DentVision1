import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The behaviour that matters is the fallback: when Redis is not there, every
 * function must say "no shared counter" rather than throw or report zero —
 * reporting zero would silently reset a spend guard to full.
 */

const { getRedis } = vi.hoisted(() => ({ getRedis: vi.fn() }));
vi.mock('./redis.js', () => ({ getRedis }));

const { clearDaily, counterKeys, incrementDaily, readDaily, utcDay } = await import('./dailyCounter.js');

function redisStub(over: Record<string, unknown> = {}) {
  return {
    incrby: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
    del: vi.fn(async () => 1),
    ...over,
  };
}

beforeEach(() => getRedis.mockReset());

describe('without Redis', () => {
  beforeEach(() => getRedis.mockReturnValue(null));

  it('reports "no shared counter" rather than zero', async () => {
    // Zero would look like a fresh budget and quietly lift the cap.
    await expect(incrementDaily('k')).resolves.toBeNull();
    await expect(readDaily('k')).resolves.toBeNull();
  });

  it('clearing is a no-op, not a crash', async () => {
    await expect(clearDaily('k')).resolves.toBeUndefined();
  });
});

describe('incrementDaily', () => {
  it('adds and returns the new total', async () => {
    const redis = redisStub({ incrby: vi.fn(async () => 7) });
    getRedis.mockReturnValue(redis);

    await expect(incrementDaily('k', 3)).resolves.toBe(7);
    expect(redis.incrby).toHaveBeenCalledWith('k', 3);
  });

  it('sets the TTL only when it created the key', async () => {
    const redis = redisStub({ incrby: vi.fn(async () => 5) });
    getRedis.mockReturnValue(redis);

    await incrementDaily('k', 5);

    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it('does not re-arm the TTL on later writes', async () => {
    // Sliding the expiry forward on every write would keep a stale day alive.
    const redis = redisStub({ incrby: vi.fn(async () => 12) });
    getRedis.mockReturnValue(redis);

    await incrementDaily('k', 5);

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('degrades to "no counter" when Redis errors mid-flight', async () => {
    getRedis.mockReturnValue(redisStub({ incrby: vi.fn(async () => { throw new Error('down'); }) }));

    await expect(incrementDaily('k')).resolves.toBeNull();
  });
});

describe('readDaily', () => {
  it('reads a stored total', async () => {
    getRedis.mockReturnValue(redisStub({ get: vi.fn(async () => '42') }));

    await expect(readDaily('k')).resolves.toBe(42);
  });

  it('treats a missing key as zero spent, not as "no counter"', async () => {
    getRedis.mockReturnValue(redisStub({ get: vi.fn(async () => null) }));

    await expect(readDaily('k')).resolves.toBe(0);
  });

  it('treats a corrupted value as zero rather than NaN', async () => {
    getRedis.mockReturnValue(redisStub({ get: vi.fn(async () => 'oops') }));

    await expect(readDaily('k')).resolves.toBe(0);
  });

  it('degrades on a read error', async () => {
    getRedis.mockReturnValue(redisStub({ get: vi.fn(async () => { throw new Error('down'); }) }));

    await expect(readDaily('k')).resolves.toBeNull();
  });
});

describe('keys', () => {
  it('carry the day, so midnight is a new key rather than a cron job', () => {
    const a = counterKeys.guestQuota('u1', '2026-08-29');
    const b = counterKeys.guestQuota('u1', '2026-08-30');

    expect(a).not.toBe(b);
    expect(a).toContain('2026-08-29');
  });

  it('separate the three counters and the users inside them', () => {
    const day = '2026-08-29';
    const keys = [
      counterKeys.modelBudget('mini', day),
      counterKeys.modelBudget('full', day),
      counterKeys.guestQuota('u1', day),
      counterKeys.guestQuota('u2', day),
      counterKeys.patientQuota('u1', day),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('utcDay is the calendar day in UTC', () => {
    expect(utcDay(new Date('2026-08-29T23:59:59Z'))).toBe('2026-08-29');
    expect(utcDay(new Date('2026-08-30T00:00:01Z'))).toBe('2026-08-30');
  });
});
