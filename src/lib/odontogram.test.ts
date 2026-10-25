import { describe, expect, it } from 'vitest'
import {
  buildPlanFromOdontogram,
  normalizeTooth,
  summarizeOdontogram,
  normalizeSurfaceStatus,
  archTeeth,
} from './odontogram'
import { getToothMorphology } from '../components/odontogram/toothMorphology'

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


  it('keeps permanent and primary dentitions anatomically distinct', () => {
    expect(archTeeth('permanent', true)).toHaveLength(16)
    expect(archTeeth('permanent', false)).toHaveLength(16)
    expect(archTeeth('primary', true)).toHaveLength(10)
    expect(archTeeth('primary', false)).toHaveLength(10)

    expect(getToothMorphology(11).pattern).toBe('incisor')
    expect(getToothMorphology(13).pattern).toBe('canine')
    expect(getToothMorphology(14).pattern).toBe('premolar1')
    expect(getToothMorphology(15).pattern).toBe('premolar2')
    expect(getToothMorphology(16).pattern).toBe('molarUpper')
    expect(getToothMorphology(46).pattern).toBe('molarLower')

    expect(getToothMorphology(16).roots).toBe(3)
    expect(getToothMorphology(36).roots).toBe(2)
    expect(getToothMorphology(18).roots).toBe(3)
    expect(getToothMorphology(48).roots).toBe(2)
  })

  it('summarizes odontogram for AI', () => {
    const s = summarizeOdontogram({ 46: { status: 'implant' }, 15: { status: 'endo_ok', surfaces: { D: 'filled' } } }, 'Тест')
    expect(s).toContain('Тест')
    expect(s).toContain('46')
    expect(s).toContain('Имплант')
    expect(s).toContain('Эндо ✓')
  })
})
