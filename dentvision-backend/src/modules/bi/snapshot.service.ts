/**
 * Daily BI snapshots — persistence for three models that existed in the
 * schema with zero code touching them (SaaSMetrics, CustomerMetrics,
 * BISnapshot; see docs/SYSTEM_AUDIT.md's "HIDDEN / DEAD" note).
 *
 * bi.service.ts already computes every number these tables store — MRR,
 * ARR, churn, CAC, LTV live in getMRR/getChurn/getCAC/getLTV, per-clinic
 * revenue/cost/profit in getClinicBI — but only ever as a live, uncached-
 * past-30-seconds response. There was no way to see last month's MRR, or
 * plot a clinic's profit trend over time, because nothing was ever kept.
 * This module doesn't recompute anything; it snapshots what already exists.
 */
import prisma from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { getMRR, getChurn, getCAC, getLTV, getClinicBI, getBIDashboard } from './bi.service.js';

/** YYYY-MM for "this month" — the period key snapshots are grouped by. */
export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export async function captureSaasMetricsSnapshot(now: Date = new Date()) {
  const [mrr, churn, cac, ltv] = await Promise.all([getMRR(), getChurn(), getCAC(), getLTV()]);
  return prisma.saaSMetrics.create({
    data: {
      tenantId: 'platform',
      mrr: BigInt(Math.round(mrr.mrr)),
      arr: BigInt(Math.round(mrr.arr)),
      cac: BigInt(Math.round(cac.cac)),
      ltv: BigInt(Math.round(ltv.ltv)),
      churn: churn.churnRate,
      activeUsers: mrr.activeClinics,
      date: now,
    },
  });
}

/**
 * One row per clinic. `lifetimeValue` has no existing formula to reuse —
 * getClinicBI has no per-clinic LTV field, only the platform-wide one — so
 * this applies the platform's own avgLifetimeMonths assumption (getLTV) to
 * this clinic's trailing-30-day profit rate, the same substitution
 * getBIDashboard's clinic-mode branch already makes for other clinic-level
 * LTV figures (bi.service.ts:566-568).
 */
export async function captureCustomerMetricsSnapshot(now: Date = new Date()) {
  const period = currentPeriod(now);
  const [clinics, ltv] = await Promise.all([
    prisma.clinic.findMany({ select: { id: true } }),
    getLTV(),
  ]);

  const rows = [];
  for (const { id: clinicId } of clinics) {
    const bi = await getClinicBI(clinicId).catch((err) => {
      console.error('[biSnapshot] getClinicBI failed', clinicId, err);
      return null;
    });
    if (!bi) continue;
    const lifetimeValue = Math.max(0, Math.round(bi.profit * ltv.avgLifetimeMonths));
    const row = await prisma.customerMetrics.create({
      data: {
        clinicId,
        revenue: BigInt(Math.round(bi.revenue.total)),
        cost: BigInt(Math.round(bi.expenses.total)),
        profit: BigInt(Math.round(bi.profit)),
        lifetimeValue: BigInt(lifetimeValue),
        period,
      },
    });
    rows.push(row);
  }
  return rows;
}

/** Makes an arbitrary bi.service.ts return value (may embed Date objects) safe for a Prisma Json column. */
function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function captureBiSnapshot(now: Date = new Date()) {
  const period = currentPeriod(now);
  const data = await getBIDashboard();
  return prisma.bISnapshot.create({
    data: { scopeType: 'PLATFORM', scopeId: 'system', period, data: toJsonSafe(data) },
  });
}

export interface DailyBiSnapshotResult {
  saasMetrics: boolean;
  customerMetricsRows: number;
  biSnapshot: boolean;
  errors: string[];
}

export async function runDailyBiSnapshots(now: Date = new Date()): Promise<DailyBiSnapshotResult> {
  const result: DailyBiSnapshotResult = {
    saasMetrics: false,
    customerMetricsRows: 0,
    biSnapshot: false,
    errors: [],
  };

  await captureSaasMetricsSnapshot(now)
    .then(() => { result.saasMetrics = true; })
    .catch((err) => { result.errors.push(`saasMetrics: ${err?.message || err}`); console.error('[biSnapshot] saasMetrics failed', err); });

  await captureCustomerMetricsSnapshot(now)
    .then((rows) => { result.customerMetricsRows = rows.length; })
    .catch((err) => { result.errors.push(`customerMetrics: ${err?.message || err}`); console.error('[biSnapshot] customerMetrics failed', err); });

  await captureBiSnapshot(now)
    .then(() => { result.biSnapshot = true; })
    .catch((err) => { result.errors.push(`biSnapshot: ${err?.message || err}`); console.error('[biSnapshot] biSnapshot failed', err); });

  return result;
}
