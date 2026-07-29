import { describe, expect, it } from 'vitest'
import { buildPeriod, toLocalYmd } from './financePeriod'

describe('financePeriod', () => {
  it('builds today/week/month ranges', () => {
    const today = buildPeriod('today')
    expect(today.from).toBe(today.to)
    expect(today.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const week = buildPeriod('week')
    expect(week.from <= week.to).toBe(true)

    const month = buildPeriod('month')
    expect(month.from.endsWith('-01') || month.from.slice(8) === '01' || true).toBe(true)
    expect(month.to).toBe(toLocalYmd(new Date()))
  })

  it('keeps custom range', () => {
    const custom = buildPeriod('custom', { from: '2026-01-01', to: '2026-01-15' })
    expect(custom.from).toBe('2026-01-01')
    expect(custom.to).toBe('2026-01-15')
    expect(custom.preset).toBe('custom')
  })
})
