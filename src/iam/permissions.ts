/**
 * IAM permission catalog (frontend mirror).
 *
 * Mirrors the server-side catalog in
 * `dentvision-backend/src/lib/permissions.ts` so the frontend and backend
 * speak one vocabulary (`domain.action`). After Step 2 of the IAM unification
 * the backend `/me` response will carry the effective permissions for the
 * active context and this catalog becomes the shared type + fallback matrix.
 */

export const IAM_PERMISSIONS = {
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
} as const

export type IamPermission = (typeof IAM_PERMISSIONS)[keyof typeof IAM_PERMISSIONS]

/**
 * Backend UserRole enum values (Prisma). The frontend resolves to these via
 * `normalizeBackendRole` so the permission matrix is shared with the server.
 */
export const BACKEND_ROLES = [
  'SUPERADMIN',
  'OWNER',
  'DIRECTOR',
  'ADMIN',
  'MANAGER',
  'DOCTOR',
  'ASSISTANT',
  'CASHIER',
  'LAB',
  'STUDENT',
  'SUPPORT',
] as const

export type BackendRole = (typeof BACKEND_ROLES)[number]
