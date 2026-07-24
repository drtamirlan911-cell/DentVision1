import { describe, it, expect } from 'vitest'
import {
  createLineItem,
  lineItemTotal,
  planTotal,
  stageTotal,
  formatTeethList,
  normalizeStages,
} from './treatment-plan'

describe('treatment-plan helpers', () => {
  it('calculates line total per tooth count', () => {
    const item = createLineItem({ id: 's1', name: 'Пломба', price: 10000 }, [16, 26])
    expect(lineItemTotal(item)).toBe(20000)
  })

  it('calculates line total as single unit without teeth', () => {
    const item = createLineItem({ id: 's2', name: 'Гигиена', price: 18000 })
    expect(lineItemTotal(item)).toBe(18000)
  })

  it('sums stages into plan total', () => {
    const stages = normalizeStages([
      {
        title: 'Этап 1',
        items: [
          { serviceName: 'A', price: 5000, teeth: [11] },
          { serviceName: 'B', price: 3000, teeth: [12, 13] },
        ],
      },
      {
        title: 'Этап 2',
        items: [{ serviceName: 'C', price: 10000, teeth: [] }],
      },
    ])
    expect(stageTotal(stages[0])).toBe(11000)
    expect(planTotal(stages)).toBe(21000)
  })

  it('formats teeth list', () => {
    expect(formatTeethList([26, 16, 11])).toBe('11, 16, 26')
    expect(formatTeethList([])).toBe('—')
  })
})
