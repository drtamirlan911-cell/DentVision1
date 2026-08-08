/**
 * Frontend role → permission matrix.
 *
 * Mirrors `ROLE_PERMISSIONS` in `dentvision-backend/src/lib/permissions.ts`.
 * This is the fallback source of truth until the backend exposes effective
 * permissions via `/me` (Step 2 of the IAM unification). Keep the two matrices
 * in sync; the tests below pin the shared vocabulary.
 */

import type { BackendRole, IamPermission } from './permissions'
import { IAM_PERMISSIONS } from './permissions'

/** Frontend (legacy) role names → backend UserRole enum values. */
export function normalizeBackendRole(role: string | null | undefined): BackendRole | null {
  const raw = String(role || 'user').toLowerCase()
  const map: Record<string, BackendRole | null> = {
    superadmin: 'SUPERADMIN',
    owner: 'OWNER',
    director: 'DIRECTOR',
    admin: 'ADMIN',
    cashier: 'ADMIN',
    manager: 'MANAGER',
    doctor: 'DOCTOR',
    assistant: 'ASSISTANT',
    reception: 'ASSISTANT',
    intern: 'STUDENT',
    student: 'STUDENT',
    lab: 'LAB',
    laboratory: 'LAB',
    lab_diagnostic: 'LAB',
    diagnostic_center: 'DOCTOR',
    accountant: 'ADMIN',
    support: 'SUPPORT',
    developer: 'SUPPORT',
    verified: 'DOCTOR',
    user: null,
  }
  return map[raw] ?? null
}

/**
 * Backend role → granted permission keys.
 * Mirrors backend ROLE_PERMISSIONS. SUPERADMIN/SUPPORT are handled in
 * `permissionsForBackendRole` (SUPERADMIN is a wildcard; SUPPORT inherits
 * read-mostly access).
 */
const BACKEND_ROLE_PERMISSIONS: Record<string, IamPermission[]> = {
  OWNER: [
    'patient.read', 'patient.write', 'patient.delete',
    'appointment.read', 'appointment.write', 'appointment.delete',
    'inventory.read', 'inventory.write', 'inventory.delete',
    'academy.manage', 'supplier.manage', 'finance.manage', 'workflow.manage',
    'bi.clinic', 'bi.finance',
  ],
  DIRECTOR: [
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
}

/** Platform-only permissions restricted to SUPERADMIN. */
const PLATFORM_ONLY: ReadonlySet<IamPermission> = new Set<IamPermission>([
  'platform.analytics',
  'compliance.manage',
  'partner.manage',
  'bi.platform',
  'bi.network',
])

/** Effective permissions for a normalized backend role. */
export function permissionsForBackendRole(role: BackendRole | null | undefined): IamPermission[] {
  if (!role) return []
  if (role === 'SUPERADMIN') {
    return Array.from(new Set(Object.values(IAM_PERMISSIONS)))
  }
  if (role === 'SUPPORT') {
    return [
      'patient.read',
      'appointment.read',
      'inventory.read',
      'bi.clinic',
    ]
  }
  return BACKEND_ROLE_PERMISSIONS[role] || []
}

/**
 * Effective permissions for a frontend role string (the primary helper used by
 * the resolver when no server-provided permissions are present).
 */
export function permissionsForRole(role: string | null | undefined): IamPermission[] {
  return permissionsForBackendRole(normalizeBackendRole(role))
}

/** True if the permission key is platform-only (superadmin wildcard territory). */
export function isPlatformOnlyPermission(key: IamPermission): boolean {
  return PLATFORM_ONLY.has(key)
}
