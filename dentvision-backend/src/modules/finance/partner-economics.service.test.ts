import { describe, expect, it } from 'vitest';
import { calculatePartnerEconomics, buildPartnerEconomicsDashboard, canonicalPartnerEconomicsRules, getPartnerEconomicsTransparency, reconcilePartnerEconomics } from './partner-economics.service.js';

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
  it('aggregates durable transparency rows and emits discrepancy/low-margin/loss alerts', () => {
    const rows = [
      { transactionId:'t1', vertical:'DIAGNOSTIC_3D', partnerId:'p1', branchId:'b1', operationId:'o1', grossMinor:100000n, commissionMinor:7000n, partnerPayoutMinor:93000n, costMinor:2000n, contributionMarginMinor:5000n, contributionMarginBps:500, status:'HEALTHY', economicsVersion:1 },
      { transactionId:'t2', vertical:'MEDICAL_ANALYSIS', partnerId:'p2', branchId:'b2', operationId:'o2', grossMinor:100000n, commissionMinor:6000n, partnerPayoutMinor:94000n, costMinor:6000n, contributionMarginMinor:0n, contributionMarginBps:0, status:'LOW_MARGIN', economicsVersion:1 },
      { transactionId:'t3', vertical:'DENTAL_LAB', partnerId:'p3', branchId:'b3', operationId:'o3', grossMinor:100000n, commissionMinor:8000n, partnerPayoutMinor:90000n, costMinor:9000n, contributionMarginMinor:-1000n, contributionMarginBps:-100, status:'LOSS', economicsVersion:1 },
      { transactionId:'t4', vertical:'DENTAL_LAB', partnerId:'p3', branchId:'b3', operationId:'o4', grossMinor:100000n, commissionMinor:8000n, partnerPayoutMinor:91000n, costMinor:1000n, contributionMarginMinor:7000n, contributionMarginBps:700, status:'HEALTHY', economicsVersion:1 },
    ] as any;
    const dashboard = buildPartnerEconomicsDashboard(rows, { from:null, to:null });
    expect(dashboard.byVertical.find(x => x.vertical === 'DENTAL_LAB')?.operations).toBe(2);
    expect(dashboard.byVertical.find(x => x.vertical === 'DENTAL_LAB')?.discrepancyCount).toBe(1);
    expect(dashboard.alerts.some(x => x.type === 'LOW_MARGIN')).toBe(true);
    expect(dashboard.alerts.some(x => x.type === 'LOSS')).toBe(true);
    expect(dashboard.alerts.some(x => x.type === 'DISCREPANCY' && x.transactionId === 't4')).toBe(true);
  });

});


describe('partner economics reconciliation', () => {
  it('flags a durable ledger transaction when its immutable economics rule snapshot is missing or malformed', async () => {
    const db = {
      payout: { findMany: async () => [] },
      transaction: {
        findMany: async () => [{
          id: 'tx-rule-missing',
          amount: 100_000n,
          refType: 'DIAGNOSTIC_3D',
          refId: 'operation-rule-missing',
          meta: {
            partnerId: 'center-1',
            economicsVersion: 1,
            commissionMinor: '7_000',
            partnerRevenueMinor: '93_000',
          },
          ledgerEntries: [
            { direction: 'debit', amount: 100_000n, wallet: { ownerType: 'GATEWAY', ownerId: 'system' } },
            { direction: 'credit', amount: 93_000n, wallet: { ownerType: 'PARTNER', ownerId: 'center-1' } },
            { direction: 'credit', amount: 7_000n, wallet: { ownerType: 'PLATFORM', ownerId: 'system' } },
          ],
        }],
      },
    } as any;
    const result = await reconcilePartnerEconomics({}, db);
    expect(result.rows[0].balanced).toBe(true);
    expect(result.rows[0].amountsMatchSnapshot).toBe(true);
    expect(result.rows[0].ruleSnapshotIntact).toBe(false);
    expect(result.discrepancies).toBe(1);
  });

  it('accepts a complete immutable economics rule snapshot at the ledger boundary', async () => {
    const db = {
      payout: { findMany: async () => [] },
      transaction: {
        findMany: async () => [{
          id: 'tx-rule-ok',
          amount: 100_000n,
          refType: 'DIAGNOSTIC_3D',
          refId: 'operation-rule-ok',
          meta: {
            partnerId: 'center-1',
            economicsVersion: 1,
            commissionMinor: '7_000',
            partnerRevenueMinor: '93_000',
            rule: {
              percentBps: 700,
              minFeeMinor: '50000',
              maxFeeMinor: '300000',
              subscriptionMinor: '4990000',
              effectiveFrom: '2026-09-11T00:00:00.000Z',
            },
          },
          ledgerEntries: [
            { direction: 'debit', amount: 100_000n, wallet: { ownerType: 'GATEWAY', ownerId: 'system' } },
            { direction: 'credit', amount: 93_000n, wallet: { ownerType: 'PARTNER', ownerId: 'center-1' } },
            { direction: 'credit', amount: 7_000n, wallet: { ownerType: 'PLATFORM', ownerId: 'system' } },
          ],
        }],
      },
    } as any;
    const result = await reconcilePartnerEconomics({}, db);
    expect(result.rows[0].ruleSnapshotIntact).toBe(true);
    expect(result.discrepancies).toBe(0);
  });

});

describe('partner economics transparency read model', () => {
  it('aggregates durable payout, costs and contribution by partner', async () => {
    const db = {
      payout: { findMany: async () => [] },
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
      payout: { findMany: async () => [] },
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
