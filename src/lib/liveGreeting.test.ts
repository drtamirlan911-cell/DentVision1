import { describe, expect, it } from 'vitest'
import { isStaticRadarGreeting } from './liveGreeting'

describe('isStaticRadarGreeting', () => {
  it('detects static role fluff without live numbers', () => {
    const text = [
      'Добрый день, Мария. Системы на связи.',
      'Клиника: DentVision Demo Clinic.',
      'На радаре: подтверждения записей, ближайшие приёмы и касса.',
      'С чего начнём?',
    ].join('\n')
    expect(isStaticRadarGreeting(text)).toBe(true)
  })

  it('accepts live CRM briefing with counts', () => {
    const text = [
      'Добрый день, Мария. Системы на связи.',
      '**DentVision Demo Clinic**',
      '',
      '• Записей сегодня: **12**',
      '• Неподтверждённых: **3**',
    ].join('\n')
    expect(isStaticRadarGreeting(text)).toBe(false)
  })
})
