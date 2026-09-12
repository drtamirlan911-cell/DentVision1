import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  settlementFindUnique: vi.fn(),
  idempotencyFindUnique: vi.fn(),
  idempotencyCreate: vi.fn(),
  idempotencyUpdate: vi.fn(),
  idempotencyDelete: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentCreate: vi.fn(),
  settlementUpdate: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: {
  settlement: { findUnique: state.settlementFindUnique, update: state.settlementUpdate },
  idempotencyRecord: {
    findUnique: state.idempotencyFindUnique,
    create: state.idempotencyCreate,
    update: state.idempotencyUpdate,
    delete: state.idempotencyDelete,
  },
  payment: { findUnique: state.paymentFindUnique, findFirst: state.paymentFindFirst, create: state.paymentCreate },
} }));
vi.mock('../payments/kaspi.provider.js', () => ({ providers: { kaspi_qr: { createPayment: state.createPayment } } }));
vi.mock('../finance/partner-economics.service.js', () => ({}));

const { paySettlement } = await import('./settlement.service.js');

const settlement = {
  id: 'settlement-1', status: 'open', commissionMinor: 70000n,
  ownerType: 'CENTER', ownerId: 'center-1',
};

const payment = {
  id: 'payment-1', externalId: 'kaspi-1', status: 'pending',
  refType: 'settlement', refId: 'settlement-1', meta: { qr: 'qr-1' },
};

describe('paySettlement concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.settlementFindUnique.mockResolvedValue(settlement);
    state.idempotencyFindUnique.mockResolvedValue(null);
    state.idempotencyCreate.mockResolvedValue({ id: 'idem-1', key: 'settlement-payment:settlement-1' });
    state.createPayment.mockResolvedValue({ externalId: 'kaspi-1', qr: 'qr-1' });
    state.paymentCreate.mockResolvedValue(payment);
    state.settlementUpdate.mockResolvedValue(settlement);
    state.idempotencyUpdate.mockResolvedValue({ id: 'idem-1', paymentId: 'payment-1' });
    state.paymentFindUnique.mockResolvedValue(payment);
    state.paymentFindFirst.mockResolvedValue(null);
  });

  it('reserves the settlement before the gateway call', async () => {
    await paySettlement('settlement-1');
    expect(state.idempotencyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: 'settlement-payment:settlement-1', expiresAt: expect.any(Date) }),
    });
    expect(state.createPayment).toHaveBeenCalledTimes(1);
    expect(state.idempotencyUpdate).toHaveBeenCalledWith({
      where: { id: 'idem-1' }, data: { paymentId: 'payment-1' },
    });
  });

  it('does not call the gateway twice when the second request loses the unique reservation race', async () => {
    state.idempotencyCreate
      .mockResolvedValueOnce({ id: 'idem-1', key: 'settlement-payment:settlement-1' })
      .mockRejectedValueOnce(new Error('unique constraint'));
    state.idempotencyFindUnique.mockImplementation(async () => ({ id: 'idem-1', key: 'settlement-payment:settlement-1', paymentId: 'payment-1', expiresAt: new Date(Date.now() + 60_000) }));

    const [first, second] = await Promise.all([
      paySettlement('settlement-1'),
      paySettlement('settlement-1'),
    ]);

    expect(state.createPayment).toHaveBeenCalledTimes(1);
    expect(first.payment.id).toBe('payment-1');
    expect(second.payment.id).toBe('payment-1');
  });
});
