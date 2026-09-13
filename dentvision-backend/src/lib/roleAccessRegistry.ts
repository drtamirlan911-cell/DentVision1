/**
 * Canonical partner-role registry.
 *
 * This file deliberately does NOT replace the existing UserRole enum or the
 * unified Person -> Role -> Permission graph. It adds the operational roles
 * that cannot safely be represented by the legacy global UserRole enum.
 *
 * Permission enforcement remains in requirePermission()/resolveUserPermissions:
 * these roles are seeded into the existing DB Role/Permission graph and are
 * therefore scoped to the active Organization/Person context.
 *
 * Role != profession. A person may hold one or more roles in one workspace,
 * while branch/patient ownership remains a separate scope concern.
 */

export type PartnerRoleFamily = 'DIAGNOSTIC_CENTER' | 'MEDICAL_LAB' | 'DENTAL_LAB';
export type RoleScope = 'ORGANIZATION' | 'BRANCH' | 'ASSIGNED' | 'OWN';

export interface PartnerRoleDefinition {
  key: string;
  family: PartnerRoleFamily;
  label: string;
  description: string;
  defaultScope: RoleScope;
  permissions: readonly string[];
}

const DIAGNOSTIC = {
  read: 'diagnostics.read',
  write: 'diagnostics.write',
  manage: 'diagnostics.manage',
  filesRead: 'files.read',
  filesWrite: 'files.write',
  medicalRead: 'medical.read',
  staffRead: 'staff.read',
  staffWrite: 'staff.write',
  staffManage: 'staff.manage',
  billingRead: 'billing.read',
  billingManage: 'billing.manage',
  analyticsRead: 'analytics.read',
  auditRead: 'audit.read',
} as const;

const LAB = {
  read: 'lab.read',
  write: 'lab.write',
  manage: 'lab.manage',
  filesRead: 'files.read',
  filesWrite: 'files.write',
  medicalRead: 'medical.read',
  staffRead: 'staff.read',
  staffWrite: 'staff.write',
  staffManage: 'staff.manage',
  billingRead: 'billing.read',
  billingManage: 'billing.manage',
  analyticsRead: 'analytics.read',
  auditRead: 'audit.read',
} as const;

const COMMON = {
  read: 'lab.read',
  write: 'lab.write',
  manage: 'lab.manage',
  filesRead: 'files.read',
  filesWrite: 'files.write',
  medicalRead: 'medical.read',
  staffRead: 'staff.read',
  staffWrite: 'staff.write',
  staffManage: 'staff.manage',
  billingRead: 'billing.read',
  billingManage: 'billing.manage',
  analyticsRead: 'analytics.read',
  auditRead: 'audit.read',
} as const;

const role = (
  key: string,
  family: PartnerRoleFamily,
  label: string,
  description: string,
  defaultScope: RoleScope,
  permissions: readonly string[],
): PartnerRoleDefinition => ({ key, family, label, description, defaultScope, permissions });

export const PARTNER_ROLE_DEFINITIONS: readonly PartnerRoleDefinition[] = [
  role('DIAGNOSTIC_OWNER', 'DIAGNOSTIC_CENTER', 'Владелец диагностического центра', 'Полное управление центром и его операционной деятельностью.', 'ORGANIZATION', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.manage, DIAGNOSTIC.filesRead, DIAGNOSTIC.filesWrite, DIAGNOSTIC.medicalRead, DIAGNOSTIC.staffRead, DIAGNOSTIC.staffWrite, DIAGNOSTIC.staffManage, DIAGNOSTIC.billingRead, DIAGNOSTIC.billingManage, DIAGNOSTIC.analyticsRead, DIAGNOSTIC.auditRead]),
  role('DIAGNOSTIC_ADMIN', 'DIAGNOSTIC_CENTER', 'Администратор диагностического центра', 'Административная и операционная работа без передачи прав владельца.', 'ORGANIZATION', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.filesRead, DIAGNOSTIC.filesWrite, DIAGNOSTIC.staffRead, DIAGNOSTIC.staffWrite, DIAGNOSTIC.billingRead, DIAGNOSTIC.analyticsRead]),
  role('DIAGNOSTIC_MANAGER', 'DIAGNOSTIC_CENTER', 'Управляющий диагностического центра', 'Управление операциями в разрешённых филиалах.', 'BRANCH', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.filesRead, DIAGNOSTIC.filesWrite, DIAGNOSTIC.staffRead, DIAGNOSTIC.billingRead, DIAGNOSTIC.analyticsRead]),
  role('DIAGNOSTIC_OPERATOR', 'DIAGNOSTIC_CENTER', 'Оператор диагностического центра', 'Приём, регистрация и обработка диагностических заказов.', 'BRANCH', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.filesRead, DIAGNOSTIC.filesWrite]),
  role('RADIOLOGIST', 'DIAGNOSTIC_CENTER', 'Рентгенолог', 'Клиническая интерпретация и валидация диагностических результатов.', 'ASSIGNED', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.manage, DIAGNOSTIC.filesRead, DIAGNOSTIC.medicalRead]),
  role('RADIOLOGY_TECHNICIAN', 'DIAGNOSTIC_CENTER', 'Рентген-лаборант', 'Выполнение исследования и загрузка технического результата.', 'BRANCH', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.filesRead, DIAGNOSTIC.filesWrite]),
  role('DIAGNOSTIC_RECEPTION', 'DIAGNOSTIC_CENTER', 'Регистратура диагностического центра', 'Регистрация пациентов, заказов и организационных статусов.', 'BRANCH', [DIAGNOSTIC.read, DIAGNOSTIC.write, DIAGNOSTIC.filesRead, DIAGNOSTIC.billingRead]),
  role('DIAGNOSTIC_FINANCE', 'DIAGNOSTIC_CENTER', 'Финансы диагностического центра', 'Расчёты, выплаты и финансовая аналитика центра.', 'ORGANIZATION', [DIAGNOSTIC.billingRead, DIAGNOSTIC.billingManage, DIAGNOSTIC.analyticsRead]),
  role('DIAGNOSTIC_QUALITY', 'DIAGNOSTIC_CENTER', 'Контроль качества диагностики', 'Контроль качества результатов и аудит процессов.', 'ORGANIZATION', [DIAGNOSTIC.read, DIAGNOSTIC.manage, DIAGNOSTIC.filesRead, DIAGNOSTIC.auditRead, DIAGNOSTIC.analyticsRead]),

  role('MEDICAL_LAB_OWNER', 'MEDICAL_LAB', 'Владелец медицинской лаборатории', 'Полное управление лабораторией и её операционной деятельностью.', 'ORGANIZATION', [LAB.read, LAB.write, LAB.manage, LAB.filesRead, LAB.filesWrite, LAB.medicalRead, LAB.staffRead, LAB.staffWrite, LAB.staffManage, LAB.billingRead, LAB.billingManage, LAB.analyticsRead, LAB.auditRead]),
  role('MEDICAL_LAB_ADMIN', 'MEDICAL_LAB', 'Администратор медицинской лаборатории', 'Административное управление лабораторией.', 'ORGANIZATION', [LAB.read, LAB.write, LAB.filesRead, LAB.filesWrite, LAB.staffRead, LAB.staffWrite, LAB.billingRead, LAB.analyticsRead]),
  role('MEDICAL_LAB_MANAGER', 'MEDICAL_LAB', 'Управляющий медицинской лаборатории', 'Управление операциями в разрешённых филиалах.', 'BRANCH', [LAB.read, LAB.write, LAB.filesRead, LAB.filesWrite, LAB.staffRead, LAB.billingRead, LAB.analyticsRead]),
  role('MEDICAL_LAB_RECEPTION', 'MEDICAL_LAB', 'Регистратура медицинской лаборатории', 'Приём заказов, регистрация и организационные статусы.', 'BRANCH', [LAB.read, LAB.write, LAB.filesRead, LAB.billingRead]),
  role('MEDICAL_LAB_TECHNICIAN', 'MEDICAL_LAB', 'Лаборант', 'Выполнение анализов и загрузка результатов без клинической валидации.', 'BRANCH', [LAB.read, LAB.write, LAB.filesRead, LAB.filesWrite]),
  role('MEDICAL_LAB_VALIDATOR', 'MEDICAL_LAB', 'Валидатор результатов', 'Проверка и финальная валидация лабораторных результатов.', 'ASSIGNED', [LAB.read, LAB.write, LAB.manage, LAB.filesRead, LAB.medicalRead]),
  role('MEDICAL_LAB_DOCTOR', 'MEDICAL_LAB', 'Врач лаборатории', 'Клиническая интерпретация и подтверждение результатов.', 'ASSIGNED', [LAB.read, LAB.write, LAB.manage, LAB.filesRead, LAB.medicalRead]),
  role('MEDICAL_LAB_FINANCE', 'MEDICAL_LAB', 'Финансы медицинской лаборатории', 'Финансовые операции и аналитика лаборатории.', 'ORGANIZATION', [LAB.billingRead, LAB.billingManage, LAB.analyticsRead]),
  role('MEDICAL_LAB_QUALITY', 'MEDICAL_LAB', 'Контроль качества лаборатории', 'Контроль качества, аудит и аналитика процессов.', 'ORGANIZATION', [LAB.read, LAB.manage, LAB.filesRead, LAB.auditRead, LAB.analyticsRead]),

  role('DENTAL_LAB_OWNER', 'DENTAL_LAB', 'Владелец зуботехнической лаборатории', 'Полное управление лабораторией и производством.', 'ORGANIZATION', [COMMON.read, COMMON.write, COMMON.manage, COMMON.filesRead, COMMON.filesWrite, COMMON.medicalRead, COMMON.staffRead, COMMON.staffWrite, COMMON.staffManage, COMMON.billingRead, COMMON.billingManage, COMMON.analyticsRead, COMMON.auditRead]),
  role('DENTAL_LAB_ADMIN', 'DENTAL_LAB', 'Администратор зуботехнической лаборатории', 'Административная и заказная работа лаборатории.', 'ORGANIZATION', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite, COMMON.staffRead, COMMON.staffWrite, COMMON.billingRead, COMMON.analyticsRead]),
  role('DENTAL_LAB_MANAGER', 'DENTAL_LAB', 'Управляющий зуботехнической лаборатории', 'Управление производством в разрешённых филиалах.', 'BRANCH', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite, COMMON.staffRead, COMMON.billingRead, COMMON.analyticsRead]),
  role('LAB_COORDINATOR', 'DENTAL_LAB', 'Координатор лаборатории', 'Коммуникация с клиниками и ведение заказов.', 'BRANCH', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite]),
  role('DENTAL_TECHNICIAN', 'DENTAL_LAB', 'Зубной техник', 'Производство назначенных работ и обновление статусов.', 'ASSIGNED', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite]),
  role('CAD_DESIGNER', 'DENTAL_LAB', 'CAD-дизайнер', 'Цифровое проектирование назначенных работ.', 'ASSIGNED', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite]),
  role('CERAMIST', 'DENTAL_LAB', 'Керамист', 'Производство и фиксация этапов керамических работ.', 'ASSIGNED', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite]),
  role('ORTHODONTIC_TECHNICIAN', 'DENTAL_LAB', 'Ортодонтический техник', 'Производство назначенных ортодонтических работ.', 'ASSIGNED', [COMMON.read, COMMON.write, COMMON.filesRead, COMMON.filesWrite]),
  role('QC_SPECIALIST', 'DENTAL_LAB', 'Контроль качества лаборатории', 'Контроль качества готовых работ и аудируемых статусов.', 'ORGANIZATION', [COMMON.read, COMMON.manage, COMMON.filesRead, COMMON.auditRead, COMMON.analyticsRead]),
  role('LAB_FINANCE', 'DENTAL_LAB', 'Финансы лаборатории', 'Финансовые операции и аналитика лаборатории.', 'ORGANIZATION', [COMMON.billingRead, COMMON.billingManage, COMMON.analyticsRead]),
];

export const PARTNER_ROLE_BY_KEY: Readonly<Record<string, PartnerRoleDefinition>> = Object.fromEntries(
  PARTNER_ROLE_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export const PARTNER_ROLE_KEYS = PARTNER_ROLE_DEFINITIONS.map((definition) => definition.key);
