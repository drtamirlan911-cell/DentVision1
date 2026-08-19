import { describe, expect, it } from 'vitest';

import {
  buildPlanOptions,
  hasRealChoice,
  presentableOptions,
  type PlanOptionKey,
} from './planOptions.js';
import { enrichStages, lineItemTotal, planTotal, type TreatmentPlanStage } from './treatmentPlanShape.js';

/**
 * The one thing that must never be true here is that a level disagrees with the
 * plan about arithmetic. Every level runs through `lineItemTotal`, so an
 * alternative on a line covering three teeth has to cost three of it — the tests
 * below check that by computing the expected number the same way the plan does,
 * not by hard-coding a total someone could "fix" to match a bug.
 */

function stage(overrides: Partial<TreatmentPlanStage> = {}): TreatmentPlanStage {
  return enrichStages([
    {
      id: 'stage-1',
      title: 'Этап 1',
      items: [
        {
          id: 'item-1',
          serviceId: 'crown-zirconia',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16],
          qty: 1,
        },
      ],
      ...overrides,
    },
  ])[0];
}

function totalOf(options: ReturnType<typeof buildPlanOptions>, key: PlanOptionKey): number {
  return options.find((o) => o.key === key)!.total;
}

describe('when the doctor marked no alternatives', () => {
  const options = buildPlanOptions([stage()]);

  it('returns all three levels so the snapshot shape stays stable', () => {
    expect(options.map((o) => o.key)).toEqual(['essential', 'optimal', 'premium']);
  });

  it('prices every level as the plan, because there is nothing else to price', () => {
    const planPrice = planTotal([stage()]);
    expect(totalOf(options, 'essential')).toBe(planPrice);
    expect(totalOf(options, 'optimal')).toBe(planPrice);
    expect(totalOf(options, 'premium')).toBe(planPrice);
  });

  it('reports no real choice, so the presentation shows one price rather than three identical ones', () => {
    expect(hasRealChoice(options)).toBe(false);
    expect(presentableOptions(options)).toEqual([]);
  });
});

describe('when the doctor marked alternatives', () => {
  const withAlternatives = stage({
    items: [
      {
        id: 'item-1',
        serviceId: 'crown-zirconia',
        serviceName: 'Коронка из циркония',
        price: 200_000,
        teeth: [16],
        qty: 1,
        alternatives: [
          { serviceId: 'crown-metal', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' },
          { serviceId: 'crown-emax', serviceName: 'E.max', price: 260_000, tier: 'premium' },
        ],
      },
    ],
  });
  const options = buildPlanOptions([withAlternatives]);

  it('leaves Optimal exactly as the doctor wrote it', () => {
    expect(totalOf(options, 'optimal')).toBe(200_000);
    expect(options.find((o) => o.key === 'optimal')!.choices[0]).toMatchObject({
      serviceId: 'crown-zirconia',
      source: 'plan',
    });
  });

  it('takes the cheapest essential alternative and the dearest premium one', () => {
    expect(totalOf(options, 'essential')).toBe(120_000);
    expect(totalOf(options, 'premium')).toBe(260_000);
  });

  it('marks the substituted lines so a reader can tell them from the doctor’s own', () => {
    const essential = options.find((o) => o.key === 'essential')!;
    expect(essential.choices[0]).toMatchObject({ serviceName: 'Металлокерамика', source: 'alternative' });
    expect(essential.sameAsOptimal).toBe(false);
  });

  it('offers all three when they genuinely differ', () => {
    expect(hasRealChoice(options)).toBe(true);
    expect(presentableOptions(options).map((o) => o.key)).toEqual(['essential', 'optimal', 'premium']);
  });
});

describe('the arithmetic is the plan’s own, not a second one', () => {
  it('multiplies an alternative by the line’s units, exactly as the plan does', () => {
    const threeTeeth = stage({
      items: [
        {
          id: 'item-1',
          serviceId: 'crown-zirconia',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16, 26, 36],
          qty: 1,
          alternatives: [
            { serviceId: 'crown-metal', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' },
          ],
        },
      ],
    });
    const options = buildPlanOptions([threeTeeth]);
    const expected = lineItemTotal({ ...threeTeeth.items![0], price: 120_000 });

    expect(expected).toBe(360_000);
    expect(totalOf(options, 'essential')).toBe(expected);
  });

  it('uses qty when a line has no teeth, again like the plan', () => {
    const byQty = stage({
      items: [
        {
          id: 'item-1',
          serviceId: 'hygiene',
          serviceName: 'Гигиена',
          price: 30_000,
          teeth: [],
          qty: 4,
          alternatives: [{ serviceId: 'hygiene-lite', serviceName: 'Гигиена базовая', price: 20_000, tier: 'essential' }],
        },
      ],
    });
    expect(totalOf(buildPlanOptions([byQty]), 'essential')).toBe(80_000);
  });
});

describe('a mislabelled price list is absorbed, not shown', () => {
  it('ignores an "essential" alternative that costs more than the doctor’s choice', () => {
    const wrongWay = stage({
      items: [
        {
          id: 'item-1',
          serviceId: 'crown-zirconia',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16],
          qty: 1,
          alternatives: [{ serviceId: 'x', serviceName: 'Дороже', price: 300_000, tier: 'essential' }],
        },
      ],
    });
    const options = buildPlanOptions([wrongWay]);
    // Otherwise "Essential" would be the most expensive thing on the screen.
    expect(totalOf(options, 'essential')).toBe(200_000);
    expect(options.find((o) => o.key === 'essential')!.sameAsOptimal).toBe(true);
  });

  it('ignores a "premium" alternative that costs less than the doctor’s choice', () => {
    const wrongWay = stage({
      items: [
        {
          id: 'item-1',
          serviceId: 'crown-zirconia',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16],
          qty: 1,
          alternatives: [{ serviceId: 'x', serviceName: 'Дешевле', price: 90_000, tier: 'premium' }],
        },
      ],
    });
    expect(totalOf(buildPlanOptions([wrongWay]), 'premium')).toBe(200_000);
  });

  it('drops alternatives the normaliser cannot trust at all', () => {
    const junk = enrichStages([
      {
        id: 'stage-1',
        title: 'Этап 1',
        items: [
          {
            id: 'item-1',
            serviceName: 'Коронка',
            price: 200_000,
            teeth: [16],
            alternatives: [
              { serviceId: 'a', serviceName: '', price: 100, tier: 'essential' },
              { serviceId: 'b', serviceName: 'Без цены', price: 0, tier: 'essential' },
              { serviceId: 'c', serviceName: 'Плохой tier', price: 100, tier: 'gold' },
              { serviceId: 'd', serviceName: 'Отрицательная', price: -5, tier: 'premium' },
            ] as never,
          },
        ],
      },
    ]);
    expect(junk[0].items![0].alternatives).toBeUndefined();
    expect(hasRealChoice(buildPlanOptions(junk))).toBe(false);
  });
});

describe('partial choice', () => {
  it('shows only the levels that differ, always keeping the doctor’s', () => {
    const essentialOnly = stage({
      items: [
        {
          id: 'item-1',
          serviceId: 'crown-zirconia',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16],
          qty: 1,
          alternatives: [{ serviceId: 'm', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' }],
        },
      ],
    });
    const shown = presentableOptions(buildPlanOptions([essentialOnly]));
    expect(shown.map((o) => o.key)).toEqual(['essential', 'optimal']);
  });

  it('substitutes only the lines that have an alternative, keeping the rest of the plan', () => {
    const mixed = enrichStages([
      {
        id: 'stage-1',
        title: 'Этап 1',
        items: [
          {
            id: 'item-1',
            serviceName: 'Коронка',
            price: 200_000,
            teeth: [16],
            alternatives: [{ serviceId: 'm', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' }],
          },
          { id: 'item-2', serviceName: 'Лечение кариеса', price: 18_000, teeth: [26] },
        ],
      },
    ]);
    const essential = buildPlanOptions(mixed).find((o) => o.key === 'essential')!;
    expect(essential.total).toBe(120_000 + 18_000);
    expect(essential.choices.map((c) => c.source)).toEqual(['alternative', 'plan']);
  });
});
