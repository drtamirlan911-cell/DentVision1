import { describe, expect, it } from 'vitest'
import {
  buildPlanFromOdontogram,
  normalizeTooth,
  summarizeOdontogram,
  normalizeSurfaceStatus,
} from './odontogram'

describe('odontogram', () => {
  it('normalizes legacy hex surfaces to status keys', () => {
    const t = normalizeTooth({
      status: 'healthy',
      surfaces: { O: '#F39C12', M: 'filled' },
    })
    expect(normalizeSurfaceStatus(t.surfaces?.O)).toBe('caries')
    expect(t.surfaces?.M).toBe('filled')
  })

  it('builds plan from caries surfaces, implant gap and failed endo', () => {
    const plan = buildPlanFromOdontogram({
      16: { status: 'healthy', surfaces: { O: 'caries', M: 'caries' } },
      26: { status: 'missing' },
      36: { status: 'endo_fail' },
      11: 'healthy',
    })
    expect(plan.some((p) => p.tooth === '16' && p.procedure.includes('кариеса'))).toBe(true)
    expect(plan.some((p) => p.tooth === '26')).toBe(true)
    expect(plan.some((p) => p.tooth === '36' && p.urgency === 'high')).toBe(true)
    expect(plan.some((p) => p.tooth === '11')).toBe(false)
  })

  it('summarizes odontogram for AI', () => {
    const s = summarizeOdontogram({ 46: { status: 'implant' }, 15: { status: 'endo_ok', surfaces: { D: 'filled' } } }, 'Тест')
    expect(s).toContain('Тест')
    expect(s).toContain('46')
    expect(s).toContain('Имплант')
    expect(s).toContain('Эндо ✓')
  })
})
