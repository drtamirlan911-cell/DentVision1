import { describe, expect, it } from 'vitest';
import { calculatePartnerEconomics, canonicalPartnerEconomicsRules, getPartnerEconomicsTransparency } from './partner-economics.service.js';

const [diagnostic, analysis, dentalLab] = canonicalPartnerEconomicsRules();

const base = {
  partnerId: 'partner-1',
  paymentCostMinor: 0n,
  aiCostMinor: 0n,
  storageCostMinor: 0n,
  supportCostMinor: 0n,
  refundReserveMinor: 0n,
  taxMinor: 0n,
};

describe('partner economics calculator', () => {
  it('applies diagnostic 7% with a 500 KZT floor', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 5_000n * 100n }, diagnostic);
    expect(result.commissionMinor).toBe(50_000n);

    const normal = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 10_000n * 100n }, diagnostic);
    expect(normal.commissionMinor).toBe(70_000n);
  });

  it('applies diagnostic 3,000 KZT cap', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 100_000n * 100n }, diagnostic);
    expect(result.commissionMinor).toBe(300_000n);
  });

  it('applies medical analysis 6% with floor and cap', () => {
    const floor = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 1_000n * 100n }, analysis);
    const normal = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 10_000n * 100n }, analysis);
    const cap = calculatePartnerEconomics({ ...base, vertical: 'MEDICAL_ANALYSIS', grossMinor: 100_000n * 100n }, analysis);
    expect(floor.commissionMinor).toBe(15_000n);
    expect(normal.commissionMinor).toBe(60_000n);
    expect(cap.commissionMinor).toBe(250_000n);
  });

  it('selects dental-lab volume tiers from monthly GMV', () => {
    const low = calculatePartnerEconomics({ ...base, vertical: 'DENTAL_LAB', grossMinor: 100_000n * 100n, monthlyGmvMinor: 500_000n * 100n }, dentalLab);
    const high = calculatePartnerEconomics({ ...base, vertical: 'DENTAL_LAB', grossMinor: 100_000n * 100n, monthlyGmvMinor: 40_000_000n * 100n }, dentalLab);
    expect(low.commissionMinor).toBe(100_000n * 100n / 10n);
    expect(high.commissionMinor).toBe(100_000n * 100n / 20n);
  });

  it('never reports a healthy contribution margin when operating costs exceed commission', () => {
    const result = calculatePartnerEconomics({
      ...base,
      vertical: 'DIAGNOSTIC_3D',
      grossMinor: 10_000n * 100n,
      paymentCostMinor: 100_000n,
      aiCostMinor: 50_000n,
    }, diagnostic);
    expect(result.status).toBe('LOSS');
    expect(result.contributionMarginMinor).toBeLessThan(0n);
  });

  it('preserves the exact rule snapshot used for the calculation', () => {
    const result = calculatePartnerEconomics({ ...base, vertical: 'DIAGNOSTIC_3D', grossMinor: 20_000n * 100n }, diagnostic);
    expect(result.rule.version).toBe(1);
    expect(result.rule.minFeeMinor).toBe(50_000n);
    expect(result.rule.maxFeeMinor).toBe(300_000n);
  });
});


describe('partner economics transparency read model', () => {
  it('aggregates durable payout, costs and contribution by partner', async () => {
    const db = {
      transaction: {
        findMany: async () => [{
          id: 'tx-1',
          amount: 1_000_000n,
          refType: 'DIAGNOSTIC_3D',
          refId: 'operation-1',
          meta: {
            partnerId: 'center-1',
            branchId: 'branch-1',
            commissionMinor: '70_000',
            partnerRevenueMinor: '930_000',
            contributionMarginMinor: '65_000',
            economicsVersion: 1,
            status: 'HEALTHY',
            costs: { payment: '5_000', ai: '0', storage: '0', support: '0', refundReserve: '0', tax: '0' },
          },
          ledgerEntries: [
            { direction: 'debit', amount: 1_000_000n },
            { direction: 'credit', amount: 930_000n },
            { direction: 'credit', amount: 70_000n },
          ],
        }],
      },
    } as any;

    const result = await getPartnerEconomicsTransparency({ partnerId: 'center-1', branchId: 'branch-1' }, db);
    expect(result.totals.operations).toBe(1);
    expect(result.totals.grossMinor).toBe(1_000_000n);
    expect(result.totals.commissionMinor).toBe(70_000n);
    expect(result.totals.partnerPayoutMinor).toBe(930_000n);
    expect(result.totals.costMinor).toBe(5_000n);
    expect(result.totals.contributionMarginMinor).toBe(65_000n);
    expect(result.rows[0].economicsVersion).toBe(1);
    expect(result.rows[0].branchId).toBe('branch-1');
  });

  it('filters branch without recomputing historical economics', async () => {
    const db = {
      transaction: {
        findMany: async () => [
          { id: 'a', amount: 100n, refType: 'DENTAL_LAB', refId: 'a', meta: { partnerId: 'lab', branchId: 'b1', commissionMinor: '10', partnerRevenueMinor: '90', contributionMarginMinor: '10', status: 'HEALTHY', economicsVersion: 1, costs: {} }, ledgerEntries: [] },
          { id: 'b', amount: 200n, refType: 'DENTAL_LAB', refId: 'b', meta: { partnerId: 'lab', branchId: 'b2', commissionMinor: '20', partnerRevenueMinor: '180', contributionMarginMinor: '20', status: 'HEALTHY', economicsVersion: 1, costs: {} }, ledgerEntries: [] },
        ],
      },
    } as any;
    const result = await getPartnerEconomicsTransparency({ branchId: 'b2' }, db);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].transactionId).toBe('b');
    expect(result.totals.grossMinor).toBe(200n);
  });
});
