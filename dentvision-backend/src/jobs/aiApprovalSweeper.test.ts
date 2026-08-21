import { beforeEach, describe, expect, it, vi } from 'vitest';

const { approvalUpdateMany } = vi.hoisted(() => ({
  approvalUpdateMany: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { aiApproval: { updateMany: approvalUpdateMany } },
}));

import { sweepExpiredApprovals } from './aiApprovalSweeper.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sweepExpiredApprovals', () => {
  it('only touches pending rows whose expiry has passed', async () => {
    approvalUpdateMany.mockResolvedValueOnce({ count: 3 });

    const result = await sweepExpiredApprovals();

    expect(result).toEqual({ expired: 3 });
    expect(approvalUpdateMany).toHaveBeenCalledWith({
      where: { status: 'pending', expiresAt: { lte: expect.any(Date) } },
      data: { status: 'expired' },
    });
  });

  it('does not throw when the table does not exist yet on a fresh boot (P2021)', async () => {
    approvalUpdateMany.mockRejectedValueOnce({ code: 'P2021' });

    const result = await sweepExpiredApprovals();

    expect(result).toEqual({ expired: 0 });
  });

  it('re-throws unexpected errors rather than silently swallowing them', async () => {
    approvalUpdateMany.mockRejectedValueOnce(new Error('connection reset'));

    await expect(sweepExpiredApprovals()).rejects.toThrow('connection reset');
  });
});
