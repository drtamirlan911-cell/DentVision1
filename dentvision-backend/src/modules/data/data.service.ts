import prisma from '../../lib/prisma.js';

// Data Intelligence (Phase 10, DENTVISION_V2_PLATFORM_EXTENSIONS_PLAN.md §4).
// A metric registry maps a metric definition type to a single computation, so
// BI dashboards and AI reports read the same numbers ("metrics as code").

export type MetricValue = { value: string | number; unit?: string; scope: string };

function monthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

// Registry of computations. Clinic-scoped metrics use scopeId as the clinicId.
const COMPUTATIONS: Record<string, (scopeId?: string) => Promise<MetricValue>> = {
  patient_count: async (scopeId) => ({
    value: await prisma.patient.count({ where: scopeId ? { clinicId: scopeId } : {} }),
    scope: scopeId ? 'clinic' : 'platform',
  }),
  appointment_count: async (scopeId) => ({
    value: await prisma.appointment.count({ where: scopeId ? { clinicId: scopeId } : {} }),
    scope: scopeId ? 'clinic' : 'platform',
  }),
  revenue_month: async (scopeId) => {
    const { start, end } = monthRange();
    const agg = await prisma.invoice.aggregate({
      where: { status: 'paid', createdAt: { gte: start, lte: end }, ...(scopeId ? { clinicId: scopeId } : {}) },
      _sum: { amount: true },
    });
    return { value: agg._sum.amount ?? 0, unit: 'KZT', scope: scopeId ? 'clinic' : 'platform' };
  },
  gmv_total: async () => {
    const agg = await prisma.transaction.aggregate({ where: { type: 'sale' }, _sum: { amount: true } });
    return { value: (agg._sum.amount ?? 0n).toString(), unit: 'tiyn', scope: 'platform' };
  },
  supplier_count: async () => ({ value: await prisma.supplier.count(), scope: 'platform' }),
};

export function computationExists(type: string): boolean {
  return type in COMPUTATIONS;
}

export async function computeMetricByKey(key: string, scopeId?: string): Promise<MetricValue> {
  const metric = await prisma.metric.findUnique({ where: { key } });
  if (!metric) throw new Error('Metric not found');
  const def = (metric.definition || {}) as { type?: string };
  const fn = def.type ? COMPUTATIONS[def.type] : undefined;
  if (!fn) throw new Error(`Unknown metric type: ${def.type}`);
  return fn(scopeId);
}
