import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  settlementFindUnique: vi.fn(),
  settlementUpdate: vi.fn(),
  settlementUpdateMany: vi.fn(),
  idempotencyFindUnique: vi.fn(),
  idempotencyCreate: vi.fn(),
  idempotencyUpdate: vi.fn(),
  idempotencyDelete: vi.fn(),
  idempotencyDeleteMany: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentCreate: vi.fn(),
  providerCreatePayment: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    settlement: {
      findUnique: state.settlementFindUnique,
      update: state.settlementUpdate,
      updateMany: state.settlementUpdateMany,
    },
    idempotencyRecord: {
      findUnique: state.idempotencyFindUnique,
      create: state.idempotencyCreate,
      update: state.idempotencyUpdate,
      delete: state.idempotencyDelete,
      deleteMany: state.idempotencyDeleteMany,
    },
    payment: {
      findUnique: state.paymentFindUnique,
      findFirst: state.paymentFindFirst,
      create: state.paymentCreate,
    },
  },
}));
vi.mock('../payments/kaspi.provider.js', () => ({
  providers: { kaspi_qr: { createPayment: state.providerCreatePayment } },
}));
vi.mock('../finance/partner-economics.service.js', () => ({}));

const { paySettlement } = await import('./settlement.service.js');

const qr = 'https://pay.kaspi.kz/pay/dv-settlement-1';

describe('settlement Kaspi payment link lifecycle', () => {
  let currentSettlement: any;
  const payment = {
    id: 'payment-1',
    externalId: 'dv-settlement-1',
    amount: 15_000n,
    status: 'pending',
    meta: { qr },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentSettlement = {
      id: 'settlement-1',
      ownerType: 'CENTER',
      ownerId: 'center-1',
      periodStart: new Date('2026-10-01T00:00:00.000Z'),
      periodEnd: new Date('2026-11-01T00:00:00.000Z'),
      referralCount: 3,
      commissionMinor: 15_000n,
      status: 'open',
      paymentId: null,
      dueDate: new Date('2026-11-15T00:00:00.000Z'),
      paidAt: null,
    };
    state.settlementFindUnique.mockImplementation(async () => currentSettlement);
    state.settlementUpdate.mockImplementation(async ({ data }) => {
      currentSettlement = { ...currentSettlement, ...data };
      return currentSettlement;
    });
    state.settlementUpdateMany.mockImplementation(async ({ where, data }) => {
      if (where.status?.not !== 'paid' || currentSettlement.status !== 'paid') {
        currentSettlement = { ...currentSettlement, ...data };
        return { count: 1 };
      }
      return { count: 0 };
    });
    state.idempotencyFindUnique.mockResolvedValue(null);
    state.idempotencyCreate.mockResolvedValue({ id: 'reservation-1' });
    state.idempotencyUpdate.mockResolvedValue({ id: 'reservation-1', paymentId: payment.id });
    state.idempotencyDelete.mockResolvedValue({ id: 'reservation-1' });
    state.idempotencyDeleteMany.mockResolvedValue({ count: 0 });
    state.paymentFindUnique.mockResolvedValue(payment);
    state.paymentFindFirst.mockResolvedValue(null);
    state.paymentCreate.mockResolvedValue(payment);
    state.providerCreatePayment.mockResolvedValue({ externalId: payment.externalId, qr });
  });

  it('returns the invoiced settlement snapshot after creating a Kaspi payment', async () => {
    const result = await paySettlement('settlement-1');

    expect(result.settlement.status).toBe('invoiced');
    expect(result.settlement.paymentId).toBe(payment.id);
    expect(result.payment?.id).toBe(payment.id);
    expect(result.qr).toBe(qr);
    expect(state.providerCreatePayment).toHaveBeenCalledTimes(1);
    expect(state.settlementUpdate).toHaveBeenCalledWith({
      where: { id: 'settlement-1' },
      data: { status: 'invoiced', paymentId: payment.id },
    });
  });

  it('repairs an open settlement when an existing pending Kaspi payment is reused', async () => {
    state.idempotencyFindUnique.mockResolvedValue({
      id: 'reservation-1',
      expiresAt: new Date(Date.now() + 60_000),
      paymentId: null,
    });
    state.paymentFindFirst.mockResolvedValue(payment);

    const result = await paySettlement('settlement-1');

    expect(result.settlement.status).toBe('invoiced');
    expect(result.settlement.paymentId).toBe(payment.id);
    expect(result.qr).toBe(qr);
    expect(state.providerCreatePayment).not.toHaveBeenCalled();
    expect(state.paymentCreate).not.toHaveBeenCalled();
    expect(state.settlementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'settlement-1', status: { not: 'paid' } },
      data: { status: 'invoiced', paymentId: payment.id },
    });
  });

  it('never downgrades a settlement already confirmed as paid', async () => {
    currentSettlement = { ...currentSettlement, status: 'paid', paidAt: new Date(), paymentId: payment.id };
    state.idempotencyFindUnique.mockResolvedValue({
      id: 'reservation-1',
      expiresAt: new Date(Date.now() + 60_000),
      paymentId: null,
    });
    state.paymentFindFirst.mockResolvedValue(payment);

    const result = await paySettlement('settlement-1');

    expect(result.settlement.status).toBe('paid');
    expect(currentSettlement.status).toBe('paid');
    expect(state.settlementUpdateMany).toHaveBeenCalledWith({
      where: { id: 'settlement-1', status: { not: 'paid' } },
      data: { status: 'invoiced', paymentId: payment.id },
    });
  });
});
