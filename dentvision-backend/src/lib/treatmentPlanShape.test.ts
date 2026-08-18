import { describe, expect, it } from 'vitest';

import {
  PATIENT_VISIBLE_PLAN_STATUSES,
  collectPlanTeeth,
  enrichStages,
  isPatientVisiblePlanStatus,
  lineItemTotal,
  normalizePlanItems,
  planTotal,
  stageTotal,
} from './treatmentPlanShape.js';

// The frontend keeps its own copy of this arithmetic because the plan editor
// has to show a running total before anything is saved. Two copies of money
// maths is a standing risk, so the parity test at the bottom of this file
// pins them together on a shared fixture.
import {
  lineItemTotal as fePriceOfItem,
  planTotal as fePlanTotal,
  stageTotal as feStageTotal,
  type TreatmentPlanStage as FeStage,
} from '../../../src/lib/treatment-plan';

describe('lineItemTotal', () => {
  it('charges per tooth when teeth are listed', () => {
    expect(lineItemTotal({ price: 50_000, teeth: [16, 24, 36], qty: 1 })).toBe(150_000);
  });

  it('falls back to qty when no teeth are listed', () => {
    expect(lineItemTotal({ price: 50_000, teeth: [], qty: 2 })).toBe(100_000);
  });

  it('treats teeth as authoritative over qty', () => {
    // The editor records "one crown on three teeth" as three teeth and qty 1.
    // If qty ever wins here, a three-crown line silently bills as one.
    expect(lineItemTotal({ price: 50_000, teeth: [16, 24, 36], qty: 1 })).toBe(150_000);
    expect(lineItemTotal({ price: 50_000, teeth: [16], qty: 9 })).toBe(50_000);
  });

  it('reads missing and garbage values as zero rather than NaN', () => {
    expect(lineItemTotal({})).toBe(0);
    expect(lineItemTotal({ price: undefined, teeth: undefined, qty: undefined })).toBe(0);
  });
});

describe('stageTotal', () => {
  it('sums line items when the stage has them', () => {
    const total = stageTotal({
      title: 'Этап 1',
      cost: 999,
      items: [
        { price: 10_000, teeth: [], qty: 1 },
        { price: 20_000, teeth: [11, 12], qty: 1 },
      ],
    });
    expect(total).toBe(50_000);
  });

  it('uses the stage cost only when there are no line items', () => {
    expect(stageTotal({ title: 'Этап 1', cost: 75_000, items: [] })).toBe(75_000);
    expect(stageTotal({ title: 'Этап 1', cost: 75_000 })).toBe(75_000);
  });
});

describe('normalizePlanItems', () => {
  it('passes the canonical object through with stages guaranteed to be an array', () => {
    const items = normalizePlanItems({ diagnosis: 'K04.5', stages: [{ title: 'Этап 1' }] });
    expect(items.diagnosis).toBe('K04.5');
    expect(items.stages).toHaveLength(1);
  });

  it('gives an object with no stages an empty array rather than undefined', () => {
    expect(normalizePlanItems({ diagnosis: 'K02.1' }).stages).toEqual([]);
  });

  it('wraps a flat array of line items into one stage instead of losing it', () => {
    // This is the shape ai/agents/doctor.agent.ts and medical.routes.ts used to
    // persist. Read as `items.stages` it yielded zero stages and a total of
    // zero, so a plan worth 300 000 ₸ displayed as free.
    const items = normalizePlanItems([
      { serviceName: 'Лечение канала', price: 120_000, teeth: [16] },
      { serviceName: 'Коронка', price: 180_000, teeth: [16] },
    ]);
    expect(items.stages).toHaveLength(1);
    expect(planTotal(items.stages!)).toBe(300_000);
  });

  it('survives null, a string and a number', () => {
    expect(normalizePlanItems(null).stages).toEqual([]);
    expect(normalizePlanItems('nonsense').stages).toEqual([]);
    expect(normalizePlanItems(42).stages).toEqual([]);
  });
});

describe('enrichStages', () => {
  it('fills in ids, ordering and per-stage cost', () => {
    const [stage] = enrichStages([
      { title: 'Этап 1', items: [{ serviceName: 'Пломба', price: 30_000, teeth: [11, 12] }] },
    ]);
    expect(stage.id).toBeTruthy();
    expect(stage.sortOrder).toBe(1);
    expect(stage.cost).toBe(60_000);
    expect(stage.items![0].id).toBeTruthy();
    expect(stage.items![0].qty).toBe(1);
  });

  it('promotes a legacy `name` to `serviceName`', () => {
    const [stage] = enrichStages([{ title: 'Этап 1', items: [{ name: 'Осмотр', price: 5_000 }] }]);
    expect(stage.items![0].serviceName).toBe('Осмотр');
  });

  it('keeps an id the caller already set', () => {
    const [stage] = enrichStages([{ id: 'stage-fixed', title: 'Этап 1', items: [] }]);
    expect(stage.id).toBe('stage-fixed');
  });
});

describe('collectPlanTeeth', () => {
  it('returns the sorted union across stages, without duplicates', () => {
    const teeth = collectPlanTeeth([
      { title: 'a', items: [{ teeth: [36, 16] }] },
      { title: 'b', items: [{ teeth: [16, 24] }] },
    ]);
    expect(teeth).toEqual([16, 24, 36]);
  });

  it('is empty for a plan with no teeth', () => {
    expect(collectPlanTeeth([{ title: 'a', items: [] }])).toEqual([]);
  });
});

describe('PATIENT_VISIBLE_PLAN_STATUSES', () => {
  it('hides draft and proposed', () => {
    expect(isPatientVisiblePlanStatus('draft')).toBe(false);
    // `proposed` is what odontogram-plan-sync.ts stamps on the plan it writes
    // automatically on every dental-chart save — machine prices and a machine
    // diagnosis no clinician has reviewed. It must not reach the patient.
    expect(isPatientVisiblePlanStatus('proposed')).toBe(false);
    expect(isPatientVisiblePlanStatus('cancelled')).toBe(false);
  });

  it('shows plans the patient has accepted or that are under way', () => {
    expect(isPatientVisiblePlanStatus('accepted')).toBe(true);
    expect(isPatientVisiblePlanStatus('in_progress')).toBe(true);
    expect(isPatientVisiblePlanStatus('completed')).toBe(true);
    expect(isPatientVisiblePlanStatus('active')).toBe(true);
  });

  it('treats an unknown status as not visible', () => {
    // Fail closed: a status added later is hidden until someone decides
    // deliberately that the patient should see it.
    expect(isPatientVisiblePlanStatus('under_review')).toBe(false);
    expect(isPatientVisiblePlanStatus(undefined)).toBe(false);
    expect(isPatientVisiblePlanStatus(null)).toBe(false);
  });

  it('lists exactly the four visible statuses', () => {
    expect([...PATIENT_VISIBLE_PLAN_STATUSES]).toEqual([
      'active',
      'accepted',
      'in_progress',
      'completed',
    ]);
  });
});

describe('parity with the frontend copy in src/lib/treatment-plan.ts', () => {
  // A realistic plan: per-tooth pricing, a multi-tooth line, a qty-only line,
  // and a stage with no items that carries its own cost.
  const stages = [
    {
      id: 's1',
      title: 'Этап 1',
      status: 'pending' as const,
      sortOrder: 1,
      cost: null,
      items: [
        { id: 'i1', serviceId: 'endo', serviceName: 'Лечение канала', price: 120_000, teeth: [16], qty: 1 },
        { id: 'i2', serviceId: 'crown', serviceName: 'Коронка', price: 180_000, teeth: [16, 24, 36], qty: 1 },
      ],
    },
    {
      id: 's2',
      title: 'Этап 2',
      status: 'pending' as const,
      sortOrder: 2,
      cost: null,
      items: [{ id: 'i3', serviceId: 'hyg', serviceName: 'Гигиена', price: 25_000, teeth: [], qty: 2 }],
    },
    {
      id: 's3',
      title: 'Контроль',
      status: 'pending' as const,
      sortOrder: 3,
      cost: 15_000,
      items: [],
    },
  ];

  it('agrees on every line item', () => {
    for (const stage of stages) {
      for (const item of stage.items) {
        expect(lineItemTotal(item)).toBe(fePriceOfItem(item));
      }
    }
  });

  it('agrees on every stage', () => {
    for (const stage of stages) {
      expect(stageTotal(stage)).toBe(feStageTotal(stage as FeStage));
    }
  });

  it('agrees on the plan total', () => {
    expect(planTotal(stages)).toBe(fePlanTotal(stages as FeStage[]));
    // 120 000 + (180 000 × 3) + (25 000 × 2) + 15 000
    expect(planTotal(stages)).toBe(725_000);
  });
});
