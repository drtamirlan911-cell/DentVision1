import type { AIAction } from '@/utils/aiExecutor'
import { AI_NAV_ACTIONS } from '@/lib/aiPlatformMap'

/**
 * Canonical AI intents for the clinical case workspace.
 * Navigation remains delegated to the existing AI executor.
 */
export const CLINICAL_CASE_ACTIONS = {
  OPEN_PATIENT: 'OpenPatients',
  OPEN_MEDICAL_CARD: 'OpenMedicalCard',
  OPEN_DENTAL_CHART: 'OpenDentalChart',
  OPEN_TREATMENT_PLAN: 'OpenTreatmentPlans',
  OPEN_SCHEDULE: 'OpenSchedule',
  OPEN_DIAGNOSTICS: 'OpenDiagnostics',
  OPEN_LAB: 'OpenLab',
  OPEN_CASHIER: 'OpenCashier',
} as const

export type ClinicalCaseAction = typeof CLINICAL_CASE_ACTIONS[keyof typeof CLINICAL_CASE_ACTIONS]

export interface ClinicalCaseContext {
  patientId?: string | null
  planId?: string | null
  visitId?: string | null
  toothId?: string | null
}

const ACTION_TO_FALLBACK: Record<ClinicalCaseAction, string> = {
  OpenPatients: '/crm/patients',
  OpenMedicalCard: '/crm/medical-card',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenSchedule: '/crm/schedule',
  OpenDiagnostics: '/diagnostics',
  OpenLab: '/crm/lab',
  OpenCashier: '/crm/cashier',
}

function withContext(path: string, context?: ClinicalCaseContext): string {
  if (!context) return path
  const params = new URLSearchParams()
  if (context.patientId) params.set('patient', context.patientId)
  if (context.planId) params.set('plan', context.planId)
  if (context.visitId) params.set('visit', context.visitId)
  if (context.toothId) params.set('tooth', context.toothId)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** Resolve an AI clinical intent without bypassing the existing executor. */
export function resolveClinicalCaseAction(
  type: string,
  context?: ClinicalCaseContext,
): AIAction | null {
  if (!(type in ACTION_TO_FALLBACK)) return null
  const actionType = type as ClinicalCaseAction
  const mapped = AI_NAV_ACTIONS[actionType]
  const path = mapped || ACTION_TO_FALLBACK[actionType]

  return {
    id: `clinical-case-${actionType}-${Date.now()}`,
    type: actionType,
    label: clinicalActionLabel(actionType),
    confidence: 1,
    requiresConfirmation: false,
    params: { path: withContext(path, context), ...context },
  }
}

export function clinicalActionLabel(type: ClinicalCaseAction): string {
  const labels: Record<ClinicalCaseAction, string> = {
    OpenPatients: 'Открыть пациента',
    OpenMedicalCard: 'Открыть медицинскую карту',
    OpenDentalChart: 'Открыть зубную карту',
    OpenTreatmentPlans: 'Открыть план лечения',
    OpenSchedule: 'Открыть расписание',
    OpenDiagnostics: 'Открыть диагностику',
    OpenLab: 'Открыть лабораторию',
    OpenCashier: 'Открыть кассу',
  }
  return labels[type]
}

export function getClinicalCaseQuickActions(context?: ClinicalCaseContext): AIAction[] {
  return (Object.values(CLINICAL_CASE_ACTIONS) as ClinicalCaseAction[])
    .map((type) => resolveClinicalCaseAction(type, context))
    .filter((action): action is AIAction => Boolean(action))
}
