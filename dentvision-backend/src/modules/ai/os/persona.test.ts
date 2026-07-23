import { describe, expect, it } from 'vitest'
import {
  allowedPersonasForRole,
  blockedPersonaRedirectMessage,
  defaultPersonaForRole,
  personaFromExplicitCall,
  personaFromIntent,
  personaFromStage,
  resolveActivePersona,
  resolveActivePersonaDetailed,
} from './persona'

describe('persona router (§16)', () => {
  it('defaults by role', () => {
    expect(defaultPersonaForRole('DOCTOR')).toBe('doctor')
    expect(defaultPersonaForRole('OWNER')).toBe('ceo')
    expect(defaultPersonaForRole('ADMIN')).toBe('reception')
    expect(defaultPersonaForRole('BUYER')).toBe('supply')
    expect(defaultPersonaForRole('GUEST')).toBe('guest')
  })

  it('allowlists clinical roles tightly', () => {
    expect(allowedPersonasForRole('DOCTOR')).toEqual(['doctor', 'reception', 'education'])
    expect(allowedPersonasForRole('ASSISTANT')).toEqual(['doctor', 'reception', 'education'])
    expect(allowedPersonasForRole('OWNER')).toContain('ceo')
    expect(allowedPersonasForRole('OWNER')).toContain('finance')
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

  it('clamps doctor away from finance/marketing/ceo', () => {
    expect(
      resolveActivePersona({
        role: 'DOCTOR',
        stage: 'finance',
        text: 'привет',
      }),
    ).toBe('doctor')

    expect(
      resolveActivePersona({
        role: 'DOCTOR',
        text: 'Покажи долги',
      }),
    ).toBe('doctor')

    expect(
      resolveActivePersona({
        role: 'DOCTOR',
        text: 'как CEO',
      }),
    ).toBe('doctor')

    expect(
      resolveActivePersona({
        role: 'DOCTOR',
        text: 'запиши Иванова',
      }),
    ).toBe('reception')

    const blocked = resolveActivePersonaDetailed({
      role: 'DOCTOR',
      text: 'спроси Finance',
    })
    expect(blocked.persona).toBe('doctor')
    expect(blocked.blockedRequest).toBe('finance')
    expect(blocked.shouldRedirect).toBe(true)
    expect(blockedPersonaRedirectMessage('DOCTOR', 'finance')).toMatch(/AI Doctor/)

    const stageOnly = resolveActivePersonaDetailed({
      role: 'DOCTOR',
      stage: 'finance',
      text: 'привет',
    })
    expect(stageOnly.persona).toBe('doctor')
    expect(stageOnly.shouldRedirect).toBeFalsy()
  })
})
