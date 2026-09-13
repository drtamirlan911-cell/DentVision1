/**
 * Canonical clinic-workspace role matrix.
 *
 * These roles are represented in the existing Role/Permission graph; this file
 * does not create a second authorization system and does not extend UserRole.
 * Scope is resolved separately by organization/branch/assignment/ownership.
 */

import type { RoleScope } from './roleAccessRegistry.js';

export interface ClinicRoleDefinition {
  key: string;
  label: string;
  description: string;
  defaultScope: RoleScope;
  permissions: readonly string[];
}

const clinicRole = (
  key: string,
  label: string,
  description: string,
  defaultScope: RoleScope,
  permissions: readonly string[],
): ClinicRoleDefinition => ({ key, label, description, defaultScope, permissions });

export const CLINIC_ROLE_DEFINITIONS: readonly ClinicRoleDefinition[] = [
  clinicRole('OWNER', 'Владелец клиники', 'Полное управление организацией, клинической ответственностью и финансами.', 'ORGANIZATION', [
    'patients.read', 'patients.write', 'patients.delete',
    'appointments.read', 'appointments.write', 'appointments.delete',
    'medical.read', 'medical.write', 'medical.delete', 'medical.manage',
    'billing.read', 'billing.write', 'billing.delete', 'billing.manage',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'lab.read', 'lab.write', 'lab.delete',
    'staff.read', 'staff.write', 'staff.delete', 'staff.manage',
    'settings.manage', 'analytics.read', 'diagnostics.read', 'diagnostics.write',
    'shop.manage', 'community.read', 'community.write', 'audit.read', 'bi.read', 'backup.read', 'dashboard.read',
  ]),
  clinicRole('ADMIN', 'Администратор клиники', 'Административное управление клиникой без клинического sign-off.', 'ORGANIZATION', [
    'patients.read', 'patients.write', 'patients.delete',
    'appointments.read', 'appointments.write', 'appointments.delete',
    'medical.read', 'medical.write',
    'billing.read', 'billing.write', 'billing.manage',
    'inventory.read', 'inventory.write', 'lab.read', 'lab.write',
    'staff.read', 'staff.write', 'settings.manage', 'analytics.read',
    'diagnostics.read', 'diagnostics.write', 'shop.manage', 'community.read', 'community.write', 'bi.read',
  ]),
  clinicRole('MANAGER', 'Управляющий клиники', 'Управление операциями в назначенных филиалах без клинического sign-off.', 'BRANCH', [
    'patients.read', 'appointments.read', 'medical.read', 'billing.read',
    'inventory.read', 'inventory.write', 'lab.read', 'staff.read',
    'settings.manage', 'analytics.read', 'diagnostics.read', 'shop.read', 'academy.read', 'bi.read', 'dashboard.read',
  ]),
  clinicRole('DOCTOR', 'Доктор', 'Клиническая работа с назначенными пациентами и подтверждение лечения.', 'ASSIGNED', [
    'patients.read', 'patients.write', 'appointments.read', 'appointments.write',
    'medical.read', 'medical.write', 'medical.manage', 'billing.read',
    'inventory.read', 'lab.read', 'lab.write', 'diagnostics.read', 'shop.read', 'academy.read', 'community.read',
  ]),
  clinicRole('ASSISTANT', 'Ассистент', 'Поддержка врача и операционная работа без клинического sign-off.', 'ASSIGNED', [
    'patients.read', 'appointments.read', 'appointments.write', 'medical.read',
    'inventory.read', 'lab.read', 'shop.read', 'academy.read', 'community.read', 'diagnostics.read',
  ]),
  clinicRole('RECEPTIONIST', 'Регистратура', 'Запись пациентов, коммуникации и организационные статусы без доступа к медицинскому sign-off.', 'BRANCH', [
    'patients.read', 'patients.write', 'appointments.read', 'appointments.write',
    'billing.read', 'billing.write', 'shop.read', 'diagnostics.read', 'academy.read',
  ]),
  clinicRole('CASHIER', 'Кассир', 'Приём платежей и работа со счетами без доступа к медицинским данным.', 'BRANCH', [
    'patients.read', 'appointments.read', 'billing.read', 'billing.write', 'billing.manage', 'shop.read',
  ]),
  clinicRole('ACCOUNTANT', 'Бухгалтер', 'Финансовый учёт и аналитика организации без клинического доступа.', 'ORGANIZATION', [
    'billing.read', 'billing.write', 'billing.manage', 'analytics.read', 'bi.read', 'audit.read',
  ]),
];

export const CLINIC_ROLE_BY_KEY: Readonly<Record<string, ClinicRoleDefinition>> = Object.fromEntries(
  CLINIC_ROLE_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export const CLINIC_ROLE_KEYS = CLINIC_ROLE_DEFINITIONS.map((definition) => definition.key);
