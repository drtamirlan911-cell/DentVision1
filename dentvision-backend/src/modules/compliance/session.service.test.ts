import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: { userSession: { updateMany } },
}));

import { expireSession } from './session.service.js';

describe('expireSession ownership boundary', () => {
  beforeEach(() => {
    updateMany.mockReset();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('filters by both session id and authenticated user id', async () => {
    await expect(expireSession('session-a', 'user-a')).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-a',
        userId: 'user-a',
        expiredAt: { gt: expect.any(Date) },
      },
      data: { expiredAt: expect.any(Date) },
    });
  });

  it('returns false when the session does not belong to the caller or is inactive', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(expireSession('session-a', 'user-b')).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
