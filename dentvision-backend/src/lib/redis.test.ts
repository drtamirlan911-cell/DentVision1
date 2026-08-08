import { beforeEach, describe, expect, it, vi } from 'vitest';

const RedisMock = vi.fn().mockImplementation(function () {
  return { on: vi.fn() };
});

vi.mock('ioredis', () => ({ Redis: RedisMock }));

beforeEach(() => {
  vi.resetModules();
  RedisMock.mockClear();
});

async function loadRedisLib(envOverrides: Record<string, string> = {}) {
  vi.doMock('../config.js', () => ({
    env: { REDIS_URL: '', REDIS_ENABLED: 'false', ...envOverrides },
  }));
  return import('./redis.js');
}

describe('getRedis', () => {
  it('returns null when REDIS_URL is unset', async () => {
    const { getRedis } = await loadRedisLib();
    expect(getRedis()).toBeNull();
    expect(RedisMock).not.toHaveBeenCalled();
  });

  it('returns null for a localhost URL without REDIS_ENABLED', async () => {
    const { getRedis } = await loadRedisLib({ REDIS_URL: 'redis://localhost:6379' });
    expect(getRedis()).toBeNull();
    expect(RedisMock).not.toHaveBeenCalled();
  });

  it('connects to a localhost URL when REDIS_ENABLED=true', async () => {
    const { getRedis } = await loadRedisLib({ REDIS_URL: 'redis://localhost:6379', REDIS_ENABLED: 'true' });
    expect(getRedis()).not.toBeNull();
    expect(RedisMock).toHaveBeenCalledOnce();
  });

  it('creates the connection with maxRetriesPerRequest: null (BullMQ requirement)', async () => {
    const { getRedis } = await loadRedisLib({ REDIS_URL: 'rediss://user:pass@host:6379' });
    getRedis();
    expect(RedisMock).toHaveBeenCalledWith(
      'rediss://user:pass@host:6379',
      expect.objectContaining({ maxRetriesPerRequest: null }),
    );
  });

  it('memoizes the connection across calls', async () => {
    const { getRedis } = await loadRedisLib({ REDIS_URL: 'rediss://user:pass@host:6379' });
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
    expect(RedisMock).toHaveBeenCalledOnce();
  });
});
