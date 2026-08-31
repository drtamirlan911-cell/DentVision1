import { describe, expect, it, vi, beforeEach } from 'vitest';

const { globalRevenueCreate, revenueGroupBy } = vi.hoisted(() => ({
  globalRevenueCreate: vi.fn(),
  revenueGroupBy: vi.fn(),
}));
vi.mock('../../lib/prisma.js', () => ({
  default: { revenue: { create: globalRevenueCreate, groupBy: revenueGroupBy } },
}));

import { writeRevenue, revenueSourceForDomain, revenueBySource } from './revenue.service.js';

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

/**
 * The reader this ledger never had. `Revenue` was listed in
 * docs/SYSTEM_MAP.md as "пишется, но никогда не читается" — written on every
 * sale, shown to nobody.
 */
describe('revenueBySource', () => {
  beforeEach(() => {
    revenueGroupBy.mockResolvedValue([
      { source: 'SHOP', _sum: { amount: 300n }, _count: { _all: 3 } },
      { source: 'MARKETPLACE', _sum: { amount: 1_000n }, _count: { _all: 2 } },
      { source: 'ACADEMY', _sum: { amount: 50n }, _count: { _all: 1 } },
    ]);
  });

  it('sums by source in one grouped query, biggest first', async () => {
    const report = await revenueBySource();

    expect(revenueGroupBy).toHaveBeenCalledTimes(1);
    expect(report.rows.map((r) => r.source)).toEqual(['MARKETPLACE', 'SHOP', 'ACADEMY']);
    expect(report.rows[0]).toMatchObject({ amountMinor: '1000', sales: 2 });
  });

  // Amounts are BigInt in the database and must not go through Number on the
  // way out — tenge ledgers in this codebase are minor units, never floats.
  it('returns amounts as strings and totals them without losing precision', async () => {
    revenueGroupBy.mockResolvedValueOnce([
      { source: 'SHOP', _sum: { amount: 9_007_199_254_740_993n }, _count: { _all: 1 } },
    ]);

    const report = await revenueBySource();

    expect(report.totalMinor).toBe('9007199254740993');
    expect(typeof report.rows[0].amountMinor).toBe('string');
  });

  it('scopes to the platform tenant and the requested range', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');

    await revenueBySource({ from, to });

    expect(revenueGroupBy.mock.calls[0][0].where).toEqual({
      tenantId: 'platform',
      date: { gte: from, lte: to },
    });
  });

  it('reports zeroes rather than throwing when nothing was sold', async () => {
    revenueGroupBy.mockResolvedValueOnce([]);

    const report = await revenueBySource();

    expect(report).toMatchObject({ rows: [], totalMinor: '0', totalSales: 0 });
  });

  // groupBy returns `_sum: { amount: null }` for a group with no rows summed.
  it('treats a null sum as zero instead of "null"', async () => {
    revenueGroupBy.mockResolvedValueOnce([{ source: 'AI', _sum: { amount: null }, _count: { _all: 0 } }]);

    const report = await revenueBySource();

    expect(report.rows[0].amountMinor).toBe('0');
  });
});
