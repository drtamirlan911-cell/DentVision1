import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Two defects this pins down, both live before Phase 0:
 *
 * 1. Neither portal read filtered by plan status, so the patient was shown
 *    drafts — including the plan `src/lib/odontogram-plan-sync.ts` writes
 *    automatically on every dental-chart save, carrying machine-estimated
 *    prices and a machine-written diagnosis nobody had reviewed.
 *
 * 2. `getTreatmentPlans` returned the stored `price` column while the CRM read
 *    (crm.routes.ts::serializePlan) recomputes from the stages. When `items`
 *    was last written by a path that does not keep `price` in step, the clinic
 *    and the patient saw two different totals for the same plan.
 */

const { treatmentPlanFindMany, patientFindUnique } = vi.hoisted(() => ({
  treatmentPlanFindMany: vi.fn(),
  patientFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    treatmentPlan: { findMany: treatmentPlanFindMany },
    patient: { findUnique: patientFindUnique },
  },
}));

import { getTreatmentPlans, getTreatments } from './patientPortal.service.js';

const CLINIC = { id: 'clinic-1', name: 'DentVision' };

beforeEach(() => {
  vi.clearAllMocks();
  patientFindUnique.mockResolvedValue({ clinic: CLINIC });
  treatmentPlanFindMany.mockResolvedValue([]);
});

function visibleStatusFilter() {
  return treatmentPlanFindMany.mock.calls[0][0].where.status.in;
}

describe('getTreatmentPlans', () => {
  it('asks the database only for patient-visible statuses', async () => {
    await getTreatmentPlans('patient-1');
    expect(treatmentPlanFindMany).toHaveBeenCalledTimes(1);
    expect(treatmentPlanFindMany.mock.calls[0][0].where.patientId).toBe('patient-1');
    expect(visibleStatusFilter()).toEqual(['active', 'accepted', 'in_progress', 'completed']);
  });

  it('never asks for draft or proposed plans', async () => {
    await getTreatmentPlans('patient-1');
    expect(visibleStatusFilter()).not.toContain('draft');
    expect(visibleStatusFilter()).not.toContain('proposed');
  });

  it('recomputes the total from the stages rather than trusting the price column', async () => {
    treatmentPlanFindMany.mockResolvedValue([
      {
        id: 'plan-1',
        title: 'План',
        status: 'accepted',
        // Stale: the stages below add up to 300 000, not 1.
        price: 1,
        notes: null,
        createdAt: new Date('2026-03-12T00:00:00Z'),
        patient: { clinic: CLINIC },
        items: {
          diagnosis: 'K04.5',
          stages: [
            {
              title: 'Этап 1',
              items: [
                { serviceName: 'Лечение канала', price: 120_000, teeth: [16], qty: 1 },
                { serviceName: 'Коронка', price: 180_000, teeth: [16], qty: 1 },
              ],
            },
          ],
        },
      },
    ]);

    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.totalBudget).toBe(300_000);
    expect(plan.teeth).toEqual([16]);
    expect(plan.stages[0].cost).toBe(300_000);
  });

  it('reads a plan whose items are a flat array, the shape the AI agent wrote', async () => {
    treatmentPlanFindMany.mockResolvedValue([
      {
        id: 'plan-2',
        title: 'План',
        status: 'in_progress',
        price: 0,
        notes: null,
        createdAt: new Date('2026-03-12T00:00:00Z'),
        patient: { clinic: CLINIC },
        items: [{ serviceName: 'Коронка', price: 180_000, teeth: [24], qty: 1 }],
      },
    ]);

    const [plan] = await getTreatmentPlans('patient-1');
    // Before normalisation this read as zero stages and a total of zero.
    expect(plan.stages).toHaveLength(1);
    expect(plan.totalBudget).toBe(180_000);
  });

  it('falls back to the stored total for a plan whose stages carry no money', async () => {
    treatmentPlanFindMany.mockResolvedValue([
      {
        id: 'plan-3',
        title: 'План',
        status: 'completed',
        price: 90_000,
        notes: 'Диагноз из notes',
        createdAt: new Date('2026-03-12T00:00:00Z'),
        patient: { clinic: CLINIC },
        items: { stages: [] },
      },
    ]);

    const [plan] = await getTreatmentPlans('patient-1');
    expect(plan.totalBudget).toBe(90_000);
    expect(plan.diagnosis).toBe('Диагноз из notes');
  });
});

describe('getTreatments', () => {
  it('asks the database only for patient-visible statuses', async () => {
    await getTreatments('patient-1');
    expect(visibleStatusFilter()).toEqual(['active', 'accepted', 'in_progress', 'completed']);
  });

  it('prices each line item per tooth', async () => {
    treatmentPlanFindMany.mockResolvedValue([
      {
        id: 'plan-1',
        createdAt: new Date('2026-03-12T00:00:00Z'),
        items: {
          diagnosis: 'K02.1',
          stages: [
            {
              notes: 'первый этап',
              items: [{ id: 'i1', serviceName: 'Коронка', price: 180_000, teeth: [16, 24, 36], qty: 1 }],
            },
          ],
        },
      },
    ]);

    const [treatment] = await getTreatments('patient-1');
    expect(treatment.cost).toBe(540_000);
    expect(treatment.toothNumber).toBe('16, 24, 36');
    expect(treatment.procedureType).toBe('Коронка');
    expect(treatment.diagnosis).toBe('K02.1');
    expect(treatment.clinic).toEqual(CLINIC);
  });

  it('flattens a plan stored as a flat array instead of dropping it', async () => {
    treatmentPlanFindMany.mockResolvedValue([
      {
        id: 'plan-2',
        createdAt: new Date('2026-03-12T00:00:00Z'),
        items: [{ id: 'i9', name: 'Осмотр', price: 5_000, teeth: [], qty: 1 }],
      },
    ]);

    const treatments = await getTreatments('patient-1');
    expect(treatments).toHaveLength(1);
    // `name` is the legacy field; it must still surface as the procedure.
    expect(treatments[0].procedureType).toBe('Осмотр');
    expect(treatments[0].cost).toBe(5_000);
  });
});
