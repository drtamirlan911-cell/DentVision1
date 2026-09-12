import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  middleware: null as null | ((params: any, next: (params: any) => Promise<any>) => Promise<any>),
  findUnique: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    referral = { findUnique: state.findUnique };
    $use(fn: typeof state.middleware) { state.middleware = fn; }
  },
}));

vi.mock('../modules/finance/partner-economics.service.js', () => ({
  PARTNER_VERTICALS: { DIAGNOSTIC_3D: 'DIAGNOSTIC_3D', MEDICAL_ANALYSIS: 'MEDICAL_ANALYSIS' },
  getPartnerEconomicsRule: vi.fn(async () => ({
    vertical: 'DIAGNOSTIC_3D', version: 1, effectiveFrom: '2026-09-11T00:00:00.000Z',
    percentBps: 700, minFeeMinor: 50_000n, maxFeeMinor: 300_000n, subscriptionMinor: 4_990_000n,
  })),
  calculatePartnerEconomics: vi.fn(() => ({ commissionMinor: 70_000n })),
}));

await import('./prisma.js');

describe('Prisma referral economics guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.findUnique.mockResolvedValue({ cost: 10000, centerId: 'center-1', labId: null });
  });

  it('normalizes atomic updateMany paid writes to canonical economics', async () => {
    expect(state.middleware).toBeTypeOf('function');
    const params = {
      model: 'Referral',
      action: 'updateMany',
      args: { where: { id: 'ref-1', paid: false }, data: { paid: true, platformFee: 1000 } },
    };
    const next = vi.fn(async (p) => p);

    const result = await state.middleware!(params, next);

    expect(result.args.data.platformFee).toBe(700);
    expect(next).toHaveBeenCalledWith(params);
  });

  it('uses the write cost for cashier-style updateMany writes', async () => {
    const params = {
      model: 'Referral',
      action: 'updateMany',
      args: { where: { id: 'ref-1', paid: false }, data: { cost: 20000, paid: true, platformFee: 2000 } },
    };
    const next = vi.fn(async (p) => p);

    await state.middleware!(params, next);

    expect(state.findUnique).toHaveBeenCalledWith({
      where: { id: 'ref-1' },
      select: { cost: true, centerId: true, labId: true },
    });
    expect(next).toHaveBeenCalledWith(params);
    expect(params.args.data.platformFee).toBe(700);
  });
});
