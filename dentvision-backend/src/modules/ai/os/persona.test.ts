import { describe, expect, it } from 'vitest'
import {
  defaultPersonaForRole,
  personaFromExplicitCall,
  personaFromIntent,
  personaFromStage,
  resolveActivePersona,
} from './persona'

describe('persona router (§16)', () => {
  it('defaults by role', () => {
    expect(defaultPersonaForRole('DOCTOR')).toBe('doctor')
    expect(defaultPersonaForRole('OWNER')).toBe('ceo')
    expect(defaultPersonaForRole('ADMIN')).toBe('reception')
    expect(defaultPersonaForRole('BUYER')).toBe('supply')
    expect(defaultPersonaForRole('GUEST')).toBe('guest')
  })

  it('overrides by stage', () => {
    expect(personaFromStage('finance')).toBe('finance')
    expect(personaFromStage('marketing')).toBe('marketing')
    expect(personaFromStage('schedule')).toBe('reception')
    expect(personaFromStage('school')).toBe('education')
  })

  it('overrides by intent and explicit call', () => {
    expect(personaFromIntent('Покажи долги')).toBe('finance')
    expect(personaFromIntent('Сделай акцию на гигиену')).toBe('marketing')
    expect(personaFromExplicitCall('как CEO что важно')).toBe('ceo')
    expect(personaFromExplicitCall('спроси Marketing')).toBe('marketing')
  })

  it('resolve order: explicit > intent > stage > role', () => {
    expect(
      resolveActivePersona({
        role: 'OWNER',
        stage: 'finance',
        text: 'запиши Иванова на завтра',
      }),
    ).toBe('reception')

    expect(
      resolveActivePersona({
        role: 'OWNER',
        stage: 'finance',
        text: 'привет',
      }),
    ).toBe('finance')

    expect(
      resolveActivePersona({
        role: 'OWNER',
        stage: 'workspace',
        text: 'как CEO',
      }),
    ).toBe('ceo')
  })
})
