import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the patient is allowed to see of their treatment plan.
 *
 * Phase 0 gated this on `TreatmentPlan.status`, which fixed a live leak — the
 * portal had no status filter at all, so drafts and the plan generated
 * automatically on every dental-chart save were visible. That gate is now
 * replaced by something stronger: the patient side reads only
 * `TreatmentPlanRelease` rows a named doctor approved and published. These
 * tests pin the replacement, including that the released total is the frozen
 * one rather than a recomputation that could drift with the price list.
 */

const { releaseFindMany, patientFindUnique } = vi.hoisted(() => ({
  releaseFindMany: vi.fn(),
  patientFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    treatmentPlanRelease: { findMany: releaseFindMany },
    patient: { findUnique: patientFindUnique },
  },
}));

import { getTreatmentPlans, getTreatments } from './patientPortal.service.js';

const CLINIC = { id: 'clinic-1', name: 'DentVision' };
const APPROVED_AT = new Date('2026-03-12T00:00:00Z');

function release(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    planId: 'plan-1',
    version: 1,
    clinic: CLINIC,
    approvedAt: APPROVED_AT,
    publishedAt: APPROVED_AT,
    expiresAt: new Date('2026-04-11T00:00:00Z'),
    totalAmount: 300_000,
    snapshot: {
      title: 'План',
      diagnosis: 'K04.5',
      stages: [
        {
          notes: 'первый этап',
          items: [
            { id: 'i1', serviceName: 'Лечение канала', price: 120_000, teeth: [16], qty: 1 },
            { id: 'i2', serviceName: 'Коронка', price: 180_000, teeth: [16], qty: 1 },
          ],
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  patientFindUnique.mockResolvedValue({ clinic: CLINIC });
  releaseFindMany.mockResolvedValue([]);
});

function whereClause() {
  return releaseFindMany.mock.calls[0][0].where;
}

describe('getTreatmentPlans', () => {
  it('reads releases, not treatment plans', async () => {
    await getTreatmentPlans('patient-1');
    expect(releaseFindMany).toHaveBeenCalledTimes(1);
    expect(whereClause().patientId).toBe('patient-1');
  });

  it('demands approved, published and unexpired, all three', async () => {
    await getTreatmentPlans('patient-1');
    const where = whereClause();
    expect(where.status).toBe('approved');
    expect(where.publishedAt).toEqual({ not: null });
    // An expired quote is treated as absent rather than shown at a stale price.
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('returns the frozen total, not a fresh recomputation', async () => {
    // The snapshot's stages add up to 300 000 here, but the frozen figure is
    // what the patient was actually quoted, and that is what must be shown even
    // if the clinic's price list moves afterwards.
    releaseFindMany.mockResolvedValue([release({ totalAmount: 287_500 })]);
    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.totalBudget).toBe(287_500);
  });

  it('exposes the release identity plus the plan it came from', async () => {
    releaseFindMany.mockResolvedValue([release()]);
    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.id).toBe('rel-1');
    expect(plan.planId).toBe('plan-1');
    expect(plan.version).toBe(1);
    expect(plan.clinic).toEqual(CLINIC);
    expect(plan.expiresAt).toBeInstanceOf(Date);
  });

  it('unpacks the snapshot into stages, teeth and diagnosis', async () => {
    releaseFindMany.mockResolvedValue([release()]);
    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.diagnosis).toBe('K04.5');
    expect(plan.teeth).toEqual([16]);
    expect(plan.stages[0].cost).toBe(300_000);
  });

  it('reads a snapshot stored as a flat array', async () => {
    releaseFindMany.mockResolvedValue([
      release({ snapshot: [{ serviceName: 'Коронка', price: 180_000, teeth: [24], qty: 1 }], totalAmount: 180_000 }),
    ]);
    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.stages).toHaveLength(1);
    expect(plan.totalBudget).toBe(180_000);
  });
});

describe('getTreatments', () => {
  it('reads releases and applies the same three conditions', async () => {
    await getTreatments('patient-1');
    const where = whereClause();
    expect(where).toMatchObject({ patientId: 'patient-1', status: 'approved', publishedAt: { not: null } });
    expect(where.OR).toBeTruthy();
  });

  it('prices each line item per tooth', async () => {
    releaseFindMany.mockResolvedValue([
      release({
        snapshot: {
          diagnosis: 'K02.1',
          stages: [
            {
              notes: 'первый этап',
              items: [{ id: 'i1', serviceName: 'Коронка', price: 180_000, teeth: [16, 24, 36], qty: 1 }],
            },
          ],
        },
      }),
    ]);

    const [treatment] = await getTreatments('patient-1');
    expect(treatment.cost).toBe(540_000);
    expect(treatment.toothNumber).toBe('16, 24, 36');
    expect(treatment.procedureType).toBe('Коронка');
    expect(treatment.diagnosis).toBe('K02.1');
    expect(treatment.clinic).toEqual(CLINIC);
    expect(treatment.createdAt).toEqual(APPROVED_AT);
  });

  it('flattens a snapshot stored as a flat array instead of dropping it', async () => {
    releaseFindMany.mockResolvedValue([
      release({ snapshot: [{ id: 'i9', name: 'Осмотр', price: 5_000, teeth: [], qty: 1 }] }),
    ]);
    const treatments = await getTreatments('patient-1');
    expect(treatments).toHaveLength(1);
    // `name` is the legacy field; it must still surface as the procedure.
    expect(treatments[0].procedureType).toBe('Осмотр');
    expect(treatments[0].cost).toBe(5_000);
  });

  it('shows nothing when the patient has no published release', async () => {
    releaseFindMany.mockResolvedValue([]);
    expect(await getTreatments('patient-1')).toEqual([]);
    expect(await getTreatmentPlans('patient-1')).toEqual([]);
  });
});
