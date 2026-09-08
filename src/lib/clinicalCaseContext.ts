export interface ClinicalCaseContextInput {
  patientId: string
  patientName: string
  treatmentStage?: string
  debt?: number
  nextVisit?: string
  nextVisitTime?: string
  pathname?: string | null
  search?: string | null
}

export interface ClinicalCaseContext {
  caseId: string
  caseType: 'patient-treatment-case'
  patientId: string
  patientName: string
  planId?: string
  stageId?: string
  visitId?: string
  treatmentStage?: string
  debt?: number
  nextVisit?: string
  nextVisitTime?: string
  currentModule: string
  availableActions: string[]
  source: 'patient-store' | 'route'
}

/**
 * Builds the lightweight clinical case envelope used by the AI context layer.
 * Existing patient/treatment APIs remain the source of truth; this does not
 * create a second clinical database or duplicate treatment-plan state.
 */
export function buildClinicalCaseContext(input: ClinicalCaseContextInput): ClinicalCaseContext {
  const params = new URLSearchParams(input.search || '')
  const pathname = String(input.pathname || '').toLowerCase()

  const planId = params.get('plan') || params.get('planId') || undefined
  const stageId = params.get('stage') || params.get('stageId') || undefined
  const visitId = params.get('visit') || params.get('visitId') || undefined

  let currentModule = 'patient'
  if (pathname.includes('/crm/treatment-plans')) currentModule = 'treatment-plans'
  else if (pathname.includes('/crm/dental-chart')) currentModule = 'dental-chart'
  else if (pathname.includes('/crm/medical-card')) currentModule = 'medical-card'
  else if (pathname.includes('/crm/visits')) currentModule = 'visits'
  else if (pathname.includes('/crm/schedule')) currentModule = 'schedule'
  else if (pathname.includes('/crm/cashier') || pathname.includes('/crm/finance')) currentModule = 'cashier'
  else if (pathname.includes('/diagnostics')) currentModule = 'diagnostics'

  const availableActions = [
    'OpenMedicalCard',
    'OpenDentalChart',
    'OpenTreatmentPlans',
    'OpenSchedule',
    'OpenCashier',
    'OpenVisits',
  ]

  return {
    caseId: planId ? `${input.patientId}:plan:${planId}` : `patient:${input.patientId}`,
    caseType: 'patient-treatment-case',
    patientId: input.patientId,
    patientName: input.patientName,
    planId,
    stageId,
    visitId,
    treatmentStage: input.treatmentStage,
    debt: input.debt,
    nextVisit: input.nextVisit,
    nextVisitTime: input.nextVisitTime,
    currentModule,
    availableActions,
    source: planId || stageId || visitId ? 'route' : 'patient-store',
  }
}
