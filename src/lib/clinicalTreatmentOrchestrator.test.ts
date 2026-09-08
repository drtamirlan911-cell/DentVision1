import { describe, expect, it } from 'vitest'
import { buildClinicalTreatmentWorkflow, workflowStepToAction } from './clinicalTreatmentOrchestrator'

const base = {
  caseId: 'patient:p1',
  caseType: 'patient-treatment-case' as const,
  patientId: 'p1',
  patientName: 'Иван Иванов',
  currentModule: 'patient',
  availableActions: [],
  source: 'patient-store' as const,
}

describe('clinicalTreatmentOrchestrator', () => {
  it('builds a complete deterministic clinical sequence', () => {
    const steps = buildClinicalTreatmentWorkflow(base)
    expect(steps.map((step) => step.id)).toEqual([
      'review-diagnosis',
      'treatment-plan',
      'schedule',
      'laboratory',
      'payment',
      'follow-up',
    ])
    expect(steps.find((step) => step.id === 'treatment-plan')?.requiresConfirmation).toBe(true)
    expect(steps.find((step) => step.id === 'schedule')?.requiresConfirmation).toBe(true)
  })

  it('recognizes existing plan and visit without forcing confirmation', () => {
    const steps = buildClinicalTreatmentWorkflow({ ...base, planId: 'plan-1', visitId: 'visit-1' })
    expect(steps.find((step) => step.id === 'treatment-plan')?.requiresConfirmation).toBe(false)
    expect(steps.find((step) => step.id === 'schedule')?.requiresConfirmation).toBe(false)
  })

  it('never auto-confirms an open financial balance', () => {
    const steps = buildClinicalTreatmentWorkflow({ ...base, debt: 25000 })
    const payment = steps.find((step) => step.id === 'payment')
    expect(payment?.requiresConfirmation).toBe(true)
    expect(payment?.status).toBe('available')
  })

  it('creates a context-preserving navigation action', () => {
    const steps = buildClinicalTreatmentWorkflow({ ...base, planId: 'plan-1' })
    const step = steps.find((item) => item.id === 'treatment-plan')!
    const action = workflowStepToAction(step, { patientId: 'p1', planId: 'plan-1' })
    expect(action?.params?.path).toBe('/crm/treatment-plans?patient=p1&plan=plan-1')
  })
})
