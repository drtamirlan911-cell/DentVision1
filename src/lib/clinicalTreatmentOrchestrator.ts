import type { AIAction } from '@/utils/aiExecutor'
import type { ClinicalCaseContext } from '@/lib/clinicalCaseContext'

export type ClinicalTreatmentStepId =
  | 'review-diagnosis'
  | 'treatment-plan'
  | 'schedule'
  | 'laboratory'
  | 'payment'
  | 'follow-up'

export interface ClinicalTreatmentStep {
  id: ClinicalTreatmentStepId
  title: string
  description: string
  actionType?: string
  status: 'ready' | 'available' | 'blocked'
  requiresConfirmation: boolean
}

/** Deterministic workflow planner. It never diagnoses or mutates clinical data. */
export function buildClinicalTreatmentWorkflow(context: ClinicalCaseContext): ClinicalTreatmentStep[] {
  const hasPlan = Boolean(context.planId)
  const hasVisit = Boolean(context.visitId)
  const hasDebt = Number(context.debt || 0) > 0

  return [
    {
      id: 'review-diagnosis', title: 'Проверить диагностику',
      description: 'Открыть клинические данные и доступную диагностику перед планированием.',
      actionType: 'OpenDiagnostics', status: 'ready', requiresConfirmation: false,
    },
    {
      id: 'treatment-plan', title: hasPlan ? 'Проверить план лечения' : 'Подготовить план лечения',
      description: hasPlan ? 'Открыть активный план и его этапы.' : 'AI может подготовить черновик; сохранение требует подтверждения врача.',
      actionType: 'OpenTreatmentPlans', status: hasPlan ? 'ready' : 'available', requiresConfirmation: false,
    },
    {
      id: 'schedule', title: hasVisit ? 'Проверить визит' : 'Запланировать визит',
      description: hasVisit ? 'Открыть связанный визит.' : 'Создание записи изменяет расписание и требует подтверждения.',
      actionType: 'OpenSchedule', status: hasVisit ? 'ready' : 'available', requiresConfirmation: false,
    },
    {
      id: 'laboratory', title: 'Лаборатория',
      description: 'Проверить или подготовить лабораторный этап лечения.',
      actionType: 'OpenLab', status: 'available', requiresConfirmation: false,
    },
    {
      id: 'payment', title: hasDebt ? 'Закрыть финансовый вопрос' : 'Проверить оплату',
      description: hasDebt ? 'Есть открытый баланс; оплату нельзя проводить автоматически.' : 'Открыть кассу и проверить финансовый статус.',
      actionType: 'OpenCashier', status: hasDebt ? 'available' : 'ready', requiresConfirmation: false,
    },
    {
      id: 'follow-up', title: 'Контроль и follow-up',
      description: 'После лечения сформировать задачу контроля и коммуникации с пациентом.',
      status: 'available', requiresConfirmation: true,
    },
  ]
}

export function workflowStepToAction(
  step: ClinicalTreatmentStep,
  context: Pick<ClinicalCaseContext, 'patientId' | 'planId' | 'visitId'>,
): AIAction | null {
  if (!step.actionType) return null
  const pathByAction: Record<string, string> = {
    OpenDiagnostics: '/diagnostics', OpenTreatmentPlans: '/crm/treatment-plans',
    OpenSchedule: '/crm/schedule', OpenLab: '/crm/lab', OpenCashier: '/crm/cashier',
  }
  const path = pathByAction[step.actionType]
  if (!path) return null
  const params = new URLSearchParams()
  if (context.patientId) params.set('patient', context.patientId)
  if (context.planId) params.set('plan', context.planId)
  if (context.visitId) params.set('visit', context.visitId)
  return {
    id: `clinical-workflow-${step.id}`, type: step.actionType, label: step.title,
    confidence: 1, requiresConfirmation: false,
    params: { path: params.toString() ? `${path}?${params.toString()}` : path, ...context },
  }
}
