import { describe, expect, it } from 'vitest'

import { normalizeStages } from './treatment-plan'
import { readCostBreakdown, readPresentedOptions } from './presentation/planOptions'

/**
 * Two things are pinned here, and both are silent failures rather than loud
 * ones — which is exactly why they need tests.
 *
 * `normalizeStages` rebuilds line items from a fixed field list, so anything it
 * does not name is destroyed the next time a doctor opens and saves a plan. If
 * that happened to `finding`, the patient's consequences act would simply go
 * quiet, with nothing anywhere reporting a problem.
 *
 * `readPresentedOptions` reads levels the backend already computed. If it ever
 * started computing instead of reading, a screen and an invoice could disagree
 * about a price and nobody would notice until a patient did.
 */

describe('the editor round-trip keeps what the presentation depends on', () => {
  const stages = [
    {
      id: 'stage-a',
      title: 'Срочно',
      items: [
        {
          id: 'i1',
          serviceId: 'endo',
          serviceName: 'Перелечивание каналов',
          price: 85_000,
          teeth: [16],
          qty: 1,
          finding: { status: 'endo_fail', urgency: 'high' },
          alternatives: [{ serviceId: 'm', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' }],
        },
      ],
    },
  ]

  it('keeps the clinical finding, so the consequences act does not go quiet', () => {
    const [stage] = normalizeStages(stages)
    expect(stage.items[0].finding).toEqual({ status: 'endo_fail', urgency: 'high' })
  })

  it('keeps the alternatives the doctor marked', () => {
    const [stage] = normalizeStages(stages)
    expect(stage.items[0].alternatives).toHaveLength(1)
    expect(stage.items[0].alternatives![0].serviceName).toBe('Металлокерамика')
  })

  it('survives repeated open-and-save without eroding', () => {
    let current = stages as never[]
    for (let i = 0; i < 3; i += 1) current = normalizeStages(current) as never[]
    const [stage] = normalizeStages(current)
    expect(stage.items[0].finding?.status).toBe('endo_fail')
    expect(stage.items[0].alternatives).toHaveLength(1)
  })

  it('drops values it cannot trust, exactly as the backend does', () => {
    const [stage] = normalizeStages([
      {
        id: 's',
        title: 'Э',
        items: [
          {
            id: 'i',
            serviceName: 'Коронка',
            price: 100,
            teeth: [],
            finding: { status: 'caries', urgency: 'urgent' },
            alternatives: [
              { serviceId: 'a', serviceName: '', price: 100, tier: 'essential' },
              { serviceId: 'b', serviceName: 'Без цены', price: 0, tier: 'premium' },
              { serviceId: 'c', serviceName: 'Плохой tier', price: 100, tier: 'gold' },
            ],
          },
        ],
      },
    ])
    expect(stage.items[0].finding).toBeUndefined()
    expect(stage.items[0].alternatives).toBeUndefined()
  })
})

describe('reading the frozen option levels', () => {
  const snapshot = {
    stages: [
      {
        id: 'stage-a',
        title: 'Протезирование',
        cost: 200_000,
        items: [{ id: 'i1', serviceName: 'Коронка', price: 200_000, teeth: [16], qty: 1 }],
      },
    ],
    options: [
      { key: 'essential', total: 120_000, sameAsOptimal: false, choices: [{ source: 'alternative' }] },
      { key: 'optimal', total: 200_000, sameAsOptimal: true, choices: [{ source: 'plan' }] },
      { key: 'premium', total: 260_000, sameAsOptimal: false, choices: [{ source: 'alternative' }] },
    ],
  }

  it('returns the levels in a stable order', () => {
    expect(readPresentedOptions(snapshot).map((o) => o.key)).toEqual(['essential', 'optimal', 'premium'])
  })

  it('quotes the totals the backend froze rather than recomputing them', () => {
    expect(readPresentedOptions(snapshot).map((o) => o.total)).toEqual([120_000, 200_000, 260_000])
  })

  it('counts the lines that differ from the doctor’s choice', () => {
    const essential = readPresentedOptions(snapshot).find((o) => o.key === 'essential')!
    expect(essential.changedCount).toBe(1)
    expect(readPresentedOptions(snapshot).find((o) => o.key === 'optimal')!.changedCount).toBe(0)
  })

  it.each([
    ['nothing at all', null],
    ['a snapshot with no options key — a release frozen before options existed', { stages: [] }],
    ['options that are not an array', { options: 'three' }],
    ['options with no optimal level to compare against', { options: [{ key: 'essential', total: 1, sameAsOptimal: false }] }],
    ['levels that are all the doctor’s plan', {
      options: [
        { key: 'essential', total: 200_000, sameAsOptimal: true },
        { key: 'optimal', total: 200_000, sameAsOptimal: true },
        { key: 'premium', total: 200_000, sameAsOptimal: true },
      ],
    }],
  ])('shows no choice for %s', (_label, input) => {
    expect(readPresentedOptions(input)).toEqual([])
  })
})

describe('the cost breakdown', () => {
  it('reads each line and its stage total from the snapshot', () => {
    const stages = readCostBreakdown({
      stages: [
        {
          id: 's1',
          title: 'Лечение',
          cost: 300_000,
          items: [
            { id: 'i1', serviceName: 'Каналы', price: 120_000, teeth: [16], qty: 1 },
            { id: 'i2', serviceName: 'Коронка', price: 180_000, teeth: [16], qty: 1 },
          ],
        },
      ],
    })
    expect(stages).toHaveLength(1)
    expect(stages[0].total).toBe(300_000)
    expect(stages[0].lines.map((l) => l.total)).toEqual([120_000, 180_000])
  })

  it('multiplies by teeth, matching the plan’s own arithmetic', () => {
    const [stage] = readCostBreakdown({
      stages: [{ id: 's', title: 'Э', items: [{ id: 'i', serviceName: 'Коронка', price: 100_000, teeth: [16, 26, 36] }] }],
    })
    expect(stage.lines[0].total).toBe(300_000)
  })

  it('falls back to qty when a line names no teeth', () => {
    const [stage] = readCostBreakdown({
      stages: [{ id: 's', title: 'Э', items: [{ id: 'i', serviceName: 'Гигиена', price: 30_000, teeth: [], qty: 4 }] }],
    })
    expect(stage.lines[0].total).toBe(120_000)
  })

  it.each([['nothing', null], ['a string', 'x'], ['no stages', {}]])('returns nothing for %s', (_l, input) => {
    expect(readCostBreakdown(input)).toEqual([])
  })
})
