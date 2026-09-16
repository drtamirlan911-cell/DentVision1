import type { EcosystemParticipant, EcosystemServiceId } from './ecosystem';

export type EcosystemActionRisk = 'read' | 'draft' | 'confirm' | 'privileged';

export type EcosystemActionId =
  | 'find-provider'
  | 'create-diagnostic-referral'
  | 'review-diagnostic-result'
  | 'create-lab-order'
  | 'find-material'
  | 'open-clinical-case'
  | 'create-treatment-plan'
  | 'schedule-appointment'
  | 'review-finance'
  | 'open-academy'
  | 'find-job'
  | 'manage-branch';

export interface EcosystemActionDefinition {
  id: EcosystemActionId;
  label: string;
  description: string;
  service: EcosystemServiceId;
  participants: EcosystemParticipant[];
  risk: EcosystemActionRisk;
  path: string;
  intent: string;
  requiresOrganization?: boolean;
  requiresClinic?: boolean;
  requiresCase?: boolean;
}

export const ECOSYSTEM_ACTIONS: readonly EcosystemActionDefinition[] = [
  { id: 'find-provider', label: 'Найти партнёра', description: 'Найти подходящий диагностический центр, лабораторию или специалиста', service: 'network', participants: ['patient','professional','clinic','diagnostic_center','medical_laboratory','dental_laboratory'], risk: 'read', path: '/community', intent: 'find_provider' },
  { id: 'create-diagnostic-referral', label: 'Создать направление', description: 'Подготовить направление на исследование из текущего контекста', service: 'diagnostics', participants: ['professional','clinic'], risk: 'confirm', path: '/diagnostics', intent: 'create_diagnostic_referral', requiresOrganization: true },
  { id: 'review-diagnostic-result', label: 'Разобрать результат', description: 'Открыть результат и подготовить следующий клинический шаг', service: 'diagnostics', participants: ['professional','clinic','diagnostic_center','patient'], risk: 'read', path: '/diagnostics', intent: 'review_diagnostic_result' },
  { id: 'create-lab-order', label: 'Создать лабораторный заказ', description: 'Передать клинический кейс в зуботехническую лабораторию', service: 'dental-laboratory', participants: ['professional','clinic','dental_laboratory'], risk: 'confirm', path: '/crm/lab', intent: 'create_lab_order', requiresCase: true },
  { id: 'find-material', label: 'Найти материал', description: 'Найти материал или оборудование по клинической задаче', service: 'market', participants: ['professional','clinic','dental_laboratory','supplier'], risk: 'read', path: '/shop', intent: 'find_material' },
  { id: 'open-clinical-case', label: 'Открыть клинический кейс', description: 'Перейти к центральному объекту лечения', service: 'practice', participants: ['professional','clinic','patient'], risk: 'read', path: '/crm/cases', intent: 'open_clinical_case', requiresCase: true },
  { id: 'create-treatment-plan', label: 'Подготовить план лечения', description: 'Сформировать черновик плана на основе разрешённого контекста', service: 'practice', participants: ['professional','clinic'], risk: 'draft', path: '/crm/cases', intent: 'create_treatment_plan', requiresCase: true },
  { id: 'schedule-appointment', label: 'Запланировать визит', description: 'Подготовить запись пациента на следующий этап', service: 'practice', participants: ['professional','clinic','patient'], risk: 'confirm', path: '/appointments', intent: 'schedule_appointment' },
  { id: 'review-finance', label: 'Открыть финансы', description: 'Посмотреть финансовый контур без изменения расчётов', service: 'finance', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy','patient'], risk: 'read', path: '/analytics', intent: 'review_finance' },
  { id: 'open-academy', label: 'Продолжить обучение', description: 'Перейти к подходящему образовательному контенту', service: 'academy', participants: ['professional','student','lecturer','academy'], risk: 'read', path: '/school', intent: 'learn' },
  { id: 'find-job', label: 'Найти работу', description: 'Открыть релевантные вакансии и карьерные задачи', service: 'jobs', participants: ['professional','job_seeker','student','employer'], risk: 'read', path: '/jobs', intent: 'find_job' },
  { id: 'manage-branch', label: 'Управлять филиалами', description: 'Открыть организационный контур филиалов', service: 'administration', participants: ['clinic'], risk: 'privileged', path: '/settings/branches', intent: 'manage_branch', requiresOrganization: true },
];

export function actionsForParticipant(participant: EcosystemParticipant) {
  return ECOSYSTEM_ACTIONS.filter(action => action.participants.includes(participant));
}

export function actionById(id: EcosystemActionId) {
  return ECOSYSTEM_ACTIONS.find(action => action.id === id);
}
