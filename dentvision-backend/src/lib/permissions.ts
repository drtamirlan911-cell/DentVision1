// IAM permission catalog — domain.action keys mapped from clinic/platform roles.
import type { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  PATIENT_READ: 'patient.read',
  PATIENT_WRITE: 'patient.write',
  PATIENT_DELETE: 'patient.delete',
  APPOINTMENT_READ: 'appointment.read',
  APPOINTMENT_WRITE: 'appointment.write',
  APPOINTMENT_DELETE: 'appointment.delete',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_WRITE: 'inventory.write',
  INVENTORY_DELETE: 'inventory.delete',
  SUPPLIER_MANAGE: 'supplier.manage',
  ACADEMY_MANAGE: 'academy.manage',
  FINANCE_MANAGE: 'finance.manage',
  COMPLIANCE_MANAGE: 'compliance.manage',
  PLATFORM_ANALYTICS: 'platform.analytics',
  PARTNER_MANAGE: 'partner.manage',
  WORKFLOW_MANAGE: 'workflow.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'workflow.manage',
  ],
  ADMIN: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'workflow.manage',
  ],
  MANAGER: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write',
    'workflow.manage',
  ],
  DOCTOR: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write',
    'inventory.read',
  ],
  ASSISTANT: ['patient.read', 'appointment.read', 'appointment.write', 'inventory.read'],
  CASHIER: ['patient.read', 'appointment.read', 'inventory.read'],
  LAB: ['appointment.read', 'inventory.read'],
  STUDENT: [],
};

export function roleHasPermission(role: UserRole | string | undefined | null, key: PermissionKey): boolean {
  if (!role) return false;
  if (role === 'SUPERADMIN') return true;
  return (ROLE_PERMISSIONS[role] || []).includes(key);
}

export function permissionsForRole(role: UserRole | string | undefined | null): PermissionKey[] {
  if (!role) return [];
  if (role === 'SUPERADMIN') {
    return Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));
  }
  return ROLE_PERMISSIONS[role] || [];
}
