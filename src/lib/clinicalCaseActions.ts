import type { AIAction } from '@/utils/aiExecutor'
import { AI_NAV_ACTIONS } from '@/lib/aiPlatformMap'
import type { ClinicalCaseContext } from '@/lib/clinicalCaseContext'

/** Canonical navigation intents available inside an active clinical case. */
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

const ACTION_FALLBACKS: Partial<Record<ClinicalCaseAction, string>> = {
  OpenDiagnostics: '/diagnostics',
}

function withContext(path: string, context?: Pick<ClinicalCaseContext, 'patientId' | 'planId' | 'visitId'>) {
  if (!context) return path
  const params = new URLSearchParams()
  if (context.patientId) params.set('patient', context.patientId)
  if (context.planId) params.set('plan', context.planId)
  if (context.visitId) params.set('visit', context.visitId)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function resolveClinicalCaseAction(type: string, context?: Pick<ClinicalCaseContext, 'patientId' | 'planId' | 'visitId'>): AIAction | null {
  const actionType = type as ClinicalCaseAction
  if (!(Object.values(CLINICAL_CASE_ACTIONS) as string[]).includes(type)) return null
  const path = AI_NAV_ACTIONS[actionType] || ACTION_FALLBACKS[actionType]
  if (!path) return null

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

export function getClinicalCaseQuickActions(context?: Pick<ClinicalCaseContext, 'patientId' | 'planId' | 'visitId'>): AIAction[] {
  return (Object.values(CLINICAL_CASE_ACTIONS) as ClinicalCaseAction[])
    .map((type) => resolveClinicalCaseAction(type, context))
    .filter((action): action is AIAction => Boolean(action))
}
