import { describe, expect, it, vi, beforeEach } from 'vitest';

const { globalRevenueCreate } = vi.hoisted(() => ({ globalRevenueCreate: vi.fn() }));
vi.mock('../../lib/prisma.js', () => ({
  default: { revenue: { create: globalRevenueCreate } },
}));

import { writeRevenue, revenueSourceForDomain } from './revenue.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('revenueSourceForDomain', () => {
  it('maps known domains to their RevenueSource', () => {
    expect(revenueSourceForDomain('shop')).toBe('SHOP');
    expect(revenueSourceForDomain('school')).toBe('ACADEMY');
  });

  it('falls back to MARKETPLACE for any other domain', () => {
    expect(revenueSourceForDomain('order')).toBe('MARKETPLACE');
    expect(revenueSourceForDomain('')).toBe('MARKETPLACE');
  });
});

describe('writeRevenue', () => {
  it('writes tenantId=platform and the given amount/source through the passed db', async () => {
    const db = { revenue: { create: vi.fn().mockResolvedValue({ id: 'rev-1' }) } };

    await writeRevenue(
      { source: 'SHOP', amountMinor: 5_000n, refType: 'order', refId: 'order-1' },
      db as never,
    );

    expect(db.revenue.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'platform',
        source: 'SHOP',
        amount: 5_000n,
        meta: { refType: 'order', refId: 'order-1' },
      },
    });
    expect(globalRevenueCreate).not.toHaveBeenCalled();
  });

  it('omits meta when neither refType nor refId is given', async () => {
    const db = { revenue: { create: vi.fn().mockResolvedValue({ id: 'rev-2' }) } };

    await writeRevenue({ source: 'SaaS', amountMinor: 1_000n }, db as never);

    expect(db.revenue.create).toHaveBeenCalledWith({
      data: { tenantId: 'platform', source: 'SaaS', amount: 1_000n, meta: undefined },
    });
  });

  it('defaults to the module-level prisma client when no db is passed', async () => {
    globalRevenueCreate.mockResolvedValue({ id: 'rev-3' });

    await writeRevenue({ source: 'ACADEMY', amountMinor: 2_000n });

    expect(globalRevenueCreate).toHaveBeenCalledWith({
      data: { tenantId: 'platform', source: 'ACADEMY', amount: 2_000n, meta: undefined },
    });
  });
});
