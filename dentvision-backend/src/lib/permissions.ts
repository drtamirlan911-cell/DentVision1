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
  // Ecosystem / marketplace governance (Phase 2). supplier.manage is a
  // platform-level capability — granted to no clinic role, so only SUPERADMIN
  // (wildcard) passes today; scoped SUPPLIER memberships arrive in a later phase.
  SUPPLIER_MANAGE: 'supplier.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role → granted permissions. SUPERADMIN is a wildcard handled in roleHasPermission().
// The grants intentionally mirror the frontend role capabilities (ORG_ROLES in
// src/store/auth.store.ts) so legitimate flows keep working while low-privilege
// roles (ASSISTANT/CASHIER/LAB/STUDENT) can no longer mutate clinical data.
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  OWNER: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
  ],
  ADMIN: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
  ],
  MANAGER: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write',
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
