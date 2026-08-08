import { describe, expect, it } from 'vitest'
import { priorMonthPeriod } from './settlementCron.js'

describe('priorMonthPeriod', () => {
  it('returns [first of previous month, first of current month) in UTC', () => {
    const { periodStart, periodEnd } = priorMonthPeriod(new Date('2026-08-08T10:30:00Z'))
    expect(periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(periodEnd.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('rolls over the year boundary (January → previous December)', () => {
    const { periodStart, periodEnd } = priorMonthPeriod(new Date('2026-01-15T00:00:00Z'))
    expect(periodStart.toISOString()).toBe('2025-12-01T00:00:00.000Z')
    expect(periodEnd.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('period is exactly the previous whole month', () => {
    const { periodStart, periodEnd } = priorMonthPeriod(new Date('2026-03-31T23:59:59Z'))
    expect(periodStart.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(periodEnd.toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })
})
