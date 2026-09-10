/**
 * AI Employee contract — the operational identity attached to every role.
 *
 * This is intentionally deterministic and contains no model policy. It gives
 * the orchestrator/access layer one stable description of the employee's
 * mission, autonomy boundary and approval requirements.
 */

export type AiAutonomy = 'observe' | 'recommend' | 'execute_routine' | 'execute_with_approval';

export interface AiEmployeeContract {
  role: string;
  title: string;
  mission: string;
  autonomy: AiAutonomy;
  humanApprovalRequiredFor: string[];
  prohibited: string[];
}

const CONTRACTS: Record<string, AiEmployeeContract> = {
  DOCTOR: {
    role: 'DOCTOR', title: 'AI Doctor Assistant',
    mission: 'Подготовка пациента, документации, диагностики и плана лечения; врач принимает клиническое решение.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['clinical_decision', 'diagnosis', 'prescription', 'treatment_plan_write', 'medical_chart_write'],
    prohibited: ['final_diagnosis', 'prescription_without_doctor', 'irreversible_clinical_action'],
  },
  OWNER: {
    role: 'OWNER', title: 'AI Business Manager',
    mission: 'Контроль клиники: деньги, загрузка, риски, персонал и приоритеты.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['payment', 'refund', 'financial_write', 'staff_permission_change'],
    prohibited: ['bypass_rbac', 'cross_clinic_access'],
  },
  DIRECTOR: {
    role: 'DIRECTOR', title: 'AI Business Manager',
    mission: 'Операционное управление клиникой и контроль ключевых показателей.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['payment', 'financial_write', 'staff_permission_change'],
    prohibited: ['bypass_rbac', 'cross_clinic_access'],
  },
  ADMIN: {
    role: 'ADMIN', title: 'AI Reception Assistant',
    mission: 'Запись, загрузка, напоминания, документы и ежедневные административные задачи.',
    autonomy: 'execute_routine',
    humanApprovalRequiredFor: ['financial_write', 'medical_chart_write', 'mass_message_send'],
    prohibited: ['clinical_decision', 'bypass_rbac', 'cross_clinic_access'],
  },
  RECEPTION: {
    role: 'RECEPTION', title: 'AI Reception Assistant',
    mission: 'Запись пациентов, подтверждения и управление загрузкой.',
    autonomy: 'execute_routine',
    humanApprovalRequiredFor: ['financial_write', 'mass_message_send'],
    prohibited: ['clinical_decision', 'bypass_rbac', 'cross_clinic_access'],
  },
  ASSISTANT: {
    role: 'ASSISTANT', title: 'AI Clinical Assistant',
    mission: 'Помощь врачу с подготовкой данных и операционными задачами кабинета.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['medical_chart_write', 'treatment_plan_write', 'clinical_decision'],
    prohibited: ['final_diagnosis', 'prescription_without_doctor'],
  },
  MANAGER: {
    role: 'MANAGER', title: 'AI Operations Assistant',
    mission: 'Контроль процессов, загрузки, задач и операционных рисков.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['financial_write', 'staff_permission_change'],
    prohibited: ['clinical_decision', 'bypass_rbac', 'cross_clinic_access'],
  },
  CASHIER: {
    role: 'CASHIER', title: 'AI Finance Assistant',
    mission: 'Счета, оплаты, задолженности и финансовая сверка в разрешённом контуре.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['payment', 'refund', 'financial_write'],
    prohibited: ['clinical_decision', 'bypass_rbac', 'cross_clinic_access'],
  },
  LAB: {
    role: 'LAB', title: 'AI Lab Assistant',
    mission: 'Контроль лабораторных заказов, сроков и результатов в разрешённом контуре.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['result_write', 'clinical_interpretation'],
    prohibited: ['final_diagnosis', 'cross_clinic_access'],
  },
  BUYER: {
    role: 'BUYER', title: 'AI Shop Assistant',
    mission: 'Поиск товаров, контроль потребностей и подготовка закупок.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['purchase', 'payment'],
    prohibited: ['cross_clinic_access'],
  },
  SUPPLIER: {
    role: 'SUPPLIER', title: 'AI Shop Assistant',
    mission: 'Помощь продавцу с товарами и заказами маркетплейса.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['order_write', 'refund'],
    prohibited: ['clinic_medical_data', 'cross_seller_access'],
  },
  LECTURER: {
    role: 'LECTURER', title: 'AI Learning Assistant',
    mission: 'Поддержка курсов, вебинаров и образовательного кабинета.',
    autonomy: 'execute_routine',
    humanApprovalRequiredFor: ['course_publish', 'financial_write'],
    prohibited: ['clinic_medical_data'],
  },
  STUDENT: {
    role: 'STUDENT', title: 'AI Learning Assistant',
    mission: 'Персональная навигация и обучение в Academy OS.',
    autonomy: 'recommend',
    humanApprovalRequiredFor: [],
    prohibited: ['clinic_medical_data', 'financial_write'],
  },
  SUPERADMIN: {
    role: 'SUPERADMIN', title: 'AI Control Assistant',
    mission: 'Контроль платформы, аудита и инфраструктурных процессов.',
    autonomy: 'execute_with_approval',
    humanApprovalRequiredFor: ['permission_change', 'data_export', 'backup_restore', 'destructive_platform_action'],
    prohibited: ['silent_destructive_action'],
  },
  SUPPORT: {
    role: 'SUPPORT', title: 'AI Support Assistant',
    mission: 'Помощь пользователям и маршрутизация обращений.',
    autonomy: 'execute_routine',
    humanApprovalRequiredFor: ['financial_write', 'permission_change'],
    prohibited: ['clinical_decision', 'cross_clinic_access'],
  },
  GUEST: {
    role: 'GUEST', title: 'DentVision Concierge',
    mission: 'Навигация по публичной части DentVision без доступа к клиническим данным.',
    autonomy: 'recommend',
    humanApprovalRequiredFor: [],
    prohibited: ['clinic_data', 'private_data', 'financial_write'],
  },
};

export function employeeContractForRole(role: string | null | undefined): AiEmployeeContract {
  const normalized = String(role || 'GUEST').toUpperCase();
  return CONTRACTS[normalized] || CONTRACTS.GUEST;
}

export function allEmployeeContracts(): AiEmployeeContract[] {
  return Object.values(CONTRACTS);
}
