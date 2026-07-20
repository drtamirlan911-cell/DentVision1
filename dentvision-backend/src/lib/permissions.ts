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
  ],
  ADMIN: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
  ],
  MANAGER: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write', 'appointment.delete',
  ],
  DOCTOR: [
    'patient.read', 'patient.write',
    'appointment.read', 'appointment.write',
  ],
  ASSISTANT: ['patient.read', 'appointment.read', 'appointment.write'],
  CASHIER: ['patient.read', 'appointment.read'],
  LAB: ['appointment.read'],
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
