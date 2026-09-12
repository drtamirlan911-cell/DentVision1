import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: { settlement: { updateMany: state.updateMany } } }));
vi.mock('../payments/kaspi.provider.js', () => ({ providers: { kaspi_qr: {} } }));
vi.mock('../finance/partner-economics.service.js', () => ({}));

const { markSettlementPaid } = await import('./settlement.service.js');

describe('settlement payment callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateMany.mockResolvedValue({ count: 1 });
  });

  it('marks an unpaid settlement exactly once', async () => {
    const applied = await markSettlementPaid('settlement-1', 'payment-1');

    expect(applied).toBe(true);
    expect(state.updateMany).toHaveBeenCalledWith({
      where: { id: 'settlement-1', status: { not: 'paid' } },
      data: { status: 'paid', paidAt: expect.any(Date), paymentId: 'payment-1' },
    });
  });

  it('treats a redelivered callback as an idempotent no-op', async () => {
    state.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([
      markSettlementPaid('settlement-1', 'payment-1'),
      markSettlementPaid('settlement-1', 'payment-1'),
    ]);

    expect([first, second].sort()).toEqual([false, true]);
    expect(state.updateMany).toHaveBeenCalledTimes(2);
    for (const call of state.updateMany.mock.calls) {
      expect(call[0].where).toEqual({ id: 'settlement-1', status: { not: 'paid' } });
    }
  });
});
