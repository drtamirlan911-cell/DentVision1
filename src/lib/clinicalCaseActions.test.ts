import { describe, expect, it } from 'vitest'
import { getClinicalCaseQuickActions, resolveClinicalCaseAction } from './clinicalCaseActions'

describe('clinicalCaseActions', () => {
  it('resolves canonical routes with clinical context', () => {
    const action = resolveClinicalCaseAction('OpenTreatmentPlans', {
      patientId: 'p-1',
      planId: 'plan-7',
      visitId: 'visit-3',
    })

    expect(action?.type).toBe('OpenTreatmentPlans')
    expect(action?.params?.path).toBe('/crm/treatment-plans?patient=p-1&plan=plan-7&visit=visit-3')
  })

  it('does not invent unsupported AI intents', () => {
    expect(resolveClinicalCaseAction('DeletePatient', { patientId: 'p-1' })).toBeNull()
  })

  it('builds the complete clinical quick-action set', () => {
    const actions = getClinicalCaseQuickActions({ patientId: 'p-1' })
    expect(actions.map((a) => a.type)).toEqual([
      'OpenPatients',
      'OpenMedicalCard',
      'OpenDentalChart',
      'OpenTreatmentPlans',
      'OpenSchedule',
      'OpenDiagnostics',
      'OpenLab',
      'OpenCashier',
    ])
  })
})
