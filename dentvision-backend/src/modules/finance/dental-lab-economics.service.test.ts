import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, recordPartnerEconomics } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  recordPartnerEconomics: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: { labOrder: { findUnique } } }));
vi.mock('../../lib/money.js', () => ({ tengeToMinor: (value: number) => BigInt(Math.round(value * 100)) }));
vi.mock('./partner-economics.service.js', () => ({
  PARTNER_VERTICALS: { DENTAL_LAB: 'DENTAL_LAB' },
  recordPartnerEconomics,
}));

import { recordDentalLabOrderEconomics } from './dental-lab-economics.service.js';

describe('recordDentalLabOrderEconomics', () => {
  beforeEach(() => {
    findUnique.mockReset();
    recordPartnerEconomics.mockReset();
    recordPartnerEconomics.mockResolvedValue({ id: 'tx-1' });
  });

  it('records delivered dental-lab work against the canonical DENTAL_LAB vertical', async () => {
    findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'delivered',
      price: 100_000,
      files: { meta: { laboratoryId: 'lab-1' } },
    });

    await recordDentalLabOrderEconomics('order-1');

    expect(recordPartnerEconomics).toHaveBeenCalledWith({
      vertical: 'DENTAL_LAB',
      partnerId: 'lab-1',
      grossMinor: 10_000_000n,
      operationId: 'order-1',
    });
  });

  it('does not accrue economics before delivery', async () => {
    findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'ready',
      price: 100_000,
      files: { meta: { laboratoryId: 'lab-1' } },
    });

    await recordDentalLabOrderEconomics('order-1');

    expect(recordPartnerEconomics).not.toHaveBeenCalled();
  });

  it('does not invent a partner when the order is not assigned to a laboratory', async () => {
    findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'delivered',
      price: 100_000,
      files: { meta: {} },
    });

    await recordDentalLabOrderEconomics('order-1');

    expect(recordPartnerEconomics).not.toHaveBeenCalled();
  });

  it('does not create a zero-value economics record', async () => {
    findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'delivered',
      price: 0,
      files: { meta: { laboratoryId: 'lab-1' } },
    });

    await recordDentalLabOrderEconomics('order-1');

    expect(recordPartnerEconomics).not.toHaveBeenCalled();
  });
});
