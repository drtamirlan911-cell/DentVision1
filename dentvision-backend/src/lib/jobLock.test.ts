import { describe, expect, it, vi } from 'vitest';

const { transactionMock } = vi.hoisted(() => ({ transactionMock: vi.fn() }));

vi.mock('./prisma.js', () => ({
  default: { $transaction: transactionMock },
}));

import { withJobLock } from './jobLock.js';

/** Mimics Prisma's interactive transaction: runs the callback with a `tx` whose `$queryRaw` answers `locked`. */
function mockTransaction(locked: boolean) {
  transactionMock.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ locked }]) };
    return callback(tx);
  });
}

describe('withJobLock', () => {
  it('runs fn and returns its result when the lock is acquired', async () => {
    mockTransaction(true);
    const fn = vi.fn().mockResolvedValue('done');

    const result = await withJobLock('some_job', fn);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never calls fn and returns undefined when another instance holds the lock', async () => {
    mockTransaction(false);
    const fn = vi.fn().mockResolvedValue('done');

    const result = await withJobLock('some_job', fn);

    expect(result).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('passes a generous timeout so the lock outlives the job body', async () => {
    mockTransaction(true);
    await withJobLock('some_job', async () => 'ok');

    expect(transactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('derives a stable key from the job name — same name, same lock target every call', async () => {
    let firstKey: unknown;
    transactionMock.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        $queryRaw: vi.fn((strings: TemplateStringsArray, key: unknown) => {
          firstKey = firstKey === undefined ? key : firstKey;
          expect(key).toBe(firstKey);
          return Promise.resolve([{ locked: true }]);
        }),
      };
      return callback(tx);
    });

    await withJobLock('stable_name', async () => undefined);
    await withJobLock('stable_name', async () => undefined);
  });
});
