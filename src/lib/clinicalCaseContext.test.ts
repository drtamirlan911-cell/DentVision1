import { describe, expect, it } from 'vitest'
import { buildClinicalCaseContext } from './clinicalCaseContext'

describe('clinicalCaseContext', () => {
  const base = {
    patientId: 'patient-1',
    patientName: 'Иван Иванов',
    treatmentStage: 'treatment',
  }

  it('creates a stable patient case without route identifiers', () => {
    const result = buildClinicalCaseContext(base)
    expect(result.caseId).toBe('patient:patient-1')
    expect(result.caseType).toBe('patient-treatment-case')
    expect(result.patientId).toBe('patient-1')
    expect(result.currentModule).toBe('patient')
    expect(result.source).toBe('patient-store')
    expect(result.availableActions).toContain('OpenTreatmentPlans')
  })

  it('binds existing plan, stage and visit identifiers from the current route', () => {
    const result = buildClinicalCaseContext({
      ...base,
      pathname: '/crm/treatment-plans',
      search: '?patient=patient-1&plan=plan-7&stage=stage-2&visit=visit-3',
    })

    expect(result.caseId).toBe('patient-1:plan:plan-7')
    expect(result.planId).toBe('plan-7')
    expect(result.stageId).toBe('stage-2')
    expect(result.visitId).toBe('visit-3')
    expect(result.currentModule).toBe('treatment-plans')
    expect(result.source).toBe('route')
  })

  it('recognizes legacy finance route while keeping cashier as canonical module', () => {
    expect(buildClinicalCaseContext({ ...base, pathname: '/crm/cashier' }).currentModule).toBe('cashier')
    expect(buildClinicalCaseContext({ ...base, pathname: '/crm/finance' }).currentModule).toBe('cashier')
  })
})
