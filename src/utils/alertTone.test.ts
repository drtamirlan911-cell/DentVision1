import { describe, expect, it } from 'vitest'
import { normalizeAlertTone } from './alertTone'

describe('normalizeAlertTone', () => {
  it('keeps known UI tones', () => {
    expect(normalizeAlertTone('info')).toBe('info')
    expect(normalizeAlertTone('warning')).toBe('warning')
    expect(normalizeAlertTone('error')).toBe('error')
  })

  it('maps backend alert kinds to tones', () => {
    expect(normalizeAlertTone('unpaid')).toBe('error')
    expect(normalizeAlertTone('urgent')).toBe('error')
    expect(normalizeAlertTone('upcoming')).toBe('warning')
  })

  it('falls back safely for unknown or empty values', () => {
    expect(normalizeAlertTone(undefined)).toBe('info')
    expect(normalizeAlertTone('weird-custom')).toBe('info')
  })
})
