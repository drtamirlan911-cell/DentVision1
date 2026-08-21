import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * snapshot.service.ts's own direct Prisma calls are mocked here; bi.service.ts's
 * exported functions are mocked as a unit boundary, not re-derived — their
 * numbers are already bi.service.ts's responsibility (and its own, much larger,
 * surface to test). What this file verifies is specific to snapshot.service.ts
 * itself: rounding into BigInt columns, the per-clinic loop (one row per
 * clinic, a failing clinic doesn't take down the rest), the lifetimeValue
 * derivation (profit × avgLifetimeMonths, clamped at 0), and that
 * runDailyBiSnapshots collects each capture's own failure instead of one
 * failure aborting the other two.
 */

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    clinic: { findMany: vi.fn() },
    saaSMetrics: { create: vi.fn() },
    customerMetrics: { create: vi.fn() },
    bISnapshot: { create: vi.fn() },
  };
  return { prismaMock };
});
vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));

const { biMock } = vi.hoisted(() => {
  const biMock = {
    getMRR: vi.fn(),
    getChurn: vi.fn(),
    getCAC: vi.fn(),
    getLTV: vi.fn(),
    getClinicBI: vi.fn(),
    getBIDashboard: vi.fn(),
  };
  return { biMock };
});
vi.mock('./bi.service.js', () => biMock);

const {
  currentPeriod,
  captureSaasMetricsSnapshot,
  captureCustomerMetricsSnapshot,
  captureBiSnapshot,
  runDailyBiSnapshots,
} = await import('./snapshot.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.saaSMetrics.create.mockResolvedValue({});
  prismaMock.customerMetrics.create.mockImplementation(async ({ data }: any) => data);
  prismaMock.bISnapshot.create.mockResolvedValue({});
});

describe('currentPeriod', () => {
  it('returns YYYY-MM for the given date, in UTC', () => {
    expect(currentPeriod(new Date('2026-08-21T02:00:00Z'))).toBe('2026-08');
  });

  it('rolls over at the UTC month boundary', () => {
    expect(currentPeriod(new Date('2026-01-31T23:59:59Z'))).toBe('2026-01');
    expect(currentPeriod(new Date('2026-02-01T00:00:00Z'))).toBe('2026-02');
  });
});

describe('captureSaasMetricsSnapshot', () => {
  it('rounds bi.service.ts numbers into the BigInt columns', async () => {
    biMock.getMRR.mockResolvedValue({ mrr: 99800.4, arr: 1197604.9, activeClinics: 3 });
    biMock.getChurn.mockResolvedValue({ churnRate: 5.2 });
    biMock.getCAC.mockResolvedValue({ cac: 1200.6 });
    biMock.getLTV.mockResolvedValue({ ltv: 50000.2, avgLifetimeMonths: 24 });
    const now = new Date('2026-08-21T00:00:00Z');

    await captureSaasMetricsSnapshot(now);

    expect(prismaMock.saaSMetrics.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'platform',
        mrr: 99800n,
        arr: 1197605n,
        cac: 1201n,
        ltv: 50000n,
        churn: 5.2,
        activeUsers: 3,
        date: now,
      },
    });
  });
});

describe('captureCustomerMetricsSnapshot', () => {
  it('writes one row per clinic; lifetimeValue is profit × avgLifetimeMonths, clamped at 0', async () => {
    prismaMock.clinic.findMany.mockResolvedValue([{ id: 'clinic-1' }, { id: 'clinic-2' }]);
    biMock.getLTV.mockResolvedValue({ avgLifetimeMonths: 10 });
    biMock.getClinicBI.mockImplementation(async (clinicId: string) => ({
      revenue: { total: clinicId === 'clinic-1' ? 100000 : 0 },
      expenses: { total: 20000 },
      profit: clinicId === 'clinic-1' ? 80000 : -20000,
    }));

    const rows = await captureCustomerMetricsSnapshot(new Date('2026-08-21T00:00:00Z'));

    expect(rows).toHaveLength(2);
    expect(prismaMock.customerMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: 'clinic-1',
        revenue: 100000n,
        cost: 20000n,
        profit: 80000n,
        lifetimeValue: 800000n,
        period: '2026-08',
      }),
    });
    // Negative profit must not produce a negative lifetimeValue.
    expect(prismaMock.customerMetrics.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clinicId: 'clinic-2', profit: -20000n, lifetimeValue: 0n }),
    });
  });

  it('a clinic whose getClinicBI call fails is skipped, not fatal to the rest', async () => {
    prismaMock.clinic.findMany.mockResolvedValue([{ id: 'clinic-1' }, { id: 'clinic-2' }]);
    biMock.getLTV.mockResolvedValue({ avgLifetimeMonths: 10 });
    biMock.getClinicBI.mockImplementation(async (clinicId: string) => {
      if (clinicId === 'clinic-1') throw new Error('boom');
      return { revenue: { total: 0 }, expenses: { total: 0 }, profit: 0 };
    });

    const rows = await captureCustomerMetricsSnapshot(new Date());

    expect(rows).toHaveLength(1);
  });
});

describe('captureBiSnapshot', () => {
  it('writes the platform dashboard under scopeType PLATFORM, keyed by the current period', async () => {
    biMock.getBIDashboard.mockResolvedValue({ mode: 'platform', mrr: { mrr: 1 } });

    await captureBiSnapshot(new Date('2026-08-21T00:00:00Z'));

    expect(prismaMock.bISnapshot.create).toHaveBeenCalledWith({
      data: { scopeType: 'PLATFORM', scopeId: 'system', period: '2026-08', data: { mode: 'platform', mrr: { mrr: 1 } } },
    });
  });
});

describe('runDailyBiSnapshots', () => {
  it('one capture failing does not stop the others, and is reported by name', async () => {
    biMock.getMRR.mockRejectedValue(new Error('mrr down'));
    biMock.getChurn.mockResolvedValue({ churnRate: 0 });
    biMock.getCAC.mockResolvedValue({ cac: 0 });
    biMock.getLTV.mockResolvedValue({ ltv: 0, avgLifetimeMonths: 12 });
    prismaMock.clinic.findMany.mockResolvedValue([]);
    biMock.getBIDashboard.mockResolvedValue({ ok: true });

    const result = await runDailyBiSnapshots(new Date());

    expect(result.saasMetrics).toBe(false);
    expect(result.customerMetricsRows).toBe(0);
    expect(result.biSnapshot).toBe(true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('saasMetrics');
  });
});
