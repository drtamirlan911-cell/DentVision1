// ─────────────────────────────────────────────────────────────────────────────
// IAM permission catalog (Phase 1 — server-side authorization).
//
// This is the first, additive step of the IAM plan
// (docs/DENTVISION_V2_INTEGRATION_PLAN.md §4): a granular, server-enforced
// permission model expressed as `domain.action` keys, mapped from the current
// clinic roles. It replaces implicit "trust the JWT clinicId" checks (audit
// finding S2) without introducing the full scoped-membership schema yet, so it
// is backward compatible with existing routes.
// ─────────────────────────────────────────────────────────────────────────────
import type { UserRole } from '@prisma/client';

// Permission keys (domain.action). Extend as more modules adopt requirePermission.
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
  ACADEMY_MANAGE: 'academy.manage',
  SUPPLIER_MANAGE: 'supplier.manage',
  COMPLIANCE_MANAGE: 'compliance.manage',
  PLATFORM_ANALYTICS: 'platform.analytics',
  FINANCE_MANAGE: 'finance.manage',
  PARTNER_MANAGE: 'partner.manage',
  WORKFLOW_MANAGE: 'workflow.manage',
  BI_CLINIC: 'bi.clinic',
  BI_NETWORK: 'bi.network',
  BI_PLATFORM: 'bi.platform',
  BI_FINANCE: 'bi.finance',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role → granted permissions. SUPERADMIN is a wildcard handled in roleHasPermission().
//
// BI access matrix:
//   OWNER         → bi.clinic (full clinic BI)
//   ADMIN         → bi.clinic (clinic BI, payments/expenses)
//   MANAGER       → bi.clinic (limited: CAC/ROI/conversion)
//   DOCTOR        → (personal revenue/KPI only, no BI perm needed — frontend filter)
//   ASSISTANT     → (none)
//   CASHIER       → (payments view only, no BI perm)
//   LAB           → (none)
//   SUPERADMIN    → bi.clinic + bi.network + bi.platform + bi.finance (all)
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'academy.manage', 'supplier.manage', 'finance.manage', 'workflow.manage',
    'bi.clinic', 'bi.finance',
  ],
  ADMIN: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'academy.manage', 'supplier.manage', 'finance.manage', 'workflow.manage',
    'bi.clinic', 'bi.finance',
  ],
  MANAGER: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write',
    'bi.clinic',
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
  // Platform-only permissions: restricted to SUPERADMIN
  if (key === 'platform.analytics' || key === 'compliance.manage' || key === 'partner.manage' || key === 'bi.platform' || key === 'bi.network') {
    return role === 'SUPERADMIN';
  }
  return (ROLE_PERMISSIONS[role] || []).includes(key);
}

export function permissionsForRole(role: UserRole | string | undefined | null): PermissionKey[] {
  if (!role) return [];
  if (role === 'SUPERADMIN') {
    return Array.from(new Set(Object.values(PERMISSIONS)));
  }
  return ROLE_PERMISSIONS[role] || [];
}
