/**
 * IAM resolver — single access-decision point for the frontend.
 *
 * Step 1 of the IAM unification: an additive, behavior-preserving adapter.
 * The resolver exposes a stable API (`can`, `hasPermission`, `canAccessPage`,
 * `pages`) that currently resolves from the legacy role config (ORG_ROLES /
 * PLATFORM_ROLES via `useAuth`) and the shared permission matrix. In Step 3
 * the same API will prefer the effective permissions returned by the backend
 * (`/me`), so no consumer needs to change.
 *
 * IMPORTANT: this module is intentionally additive — no existing consumer is
 * migrated yet. Nothing here changes current app behavior.
 */

import type { IamPermission } from './permissions'
import { IAM_PERMISSIONS } from './permissions'
import { permissionsForRole } from './roleMatrix'

/** Legacy capability flags read off `roleInfo` (ORG_ROLES/PLATFORM_ROLES). */
export type IamCapability =
  | 'canSeeSalary'
  | 'canSeeOwnSalary'
  | 'canSeeSuperAdmin'
  | 'canAddStaff'
  | 'canSeeAudit'
  | 'canBackup'
  | 'canSeeReports'
  | 'canSeeExpenses'
  | 'canManageClinicSettings'
  | 'canManageFinance'
  | 'ownDataOnly'
  | 'readOnly'

export interface IamRoleInfo {
  label?: string
  icon?: string
  pages?: string[]
  canSeeSalary?: boolean
  canSeeOwnSalary?: boolean
  canSeeSuperAdmin?: boolean
  canAddStaff?: boolean
  canSeeAudit?: boolean
  canBackup?: boolean
  canSeeReports?: boolean
  canSeeExpenses?: boolean
  canManageClinicSettings?: boolean
  canManageFinance?: boolean
  ownDataOnly?: boolean
  readOnly?: boolean
  [key: string]: string | boolean | string[] | undefined
}

export interface IamContext {
  role: string | null | undefined
  roleInfo: IamRoleInfo | null | undefined
  /**
   * Effective permissions for the active context when provided by the backend
   * (Step 2+). When present, `hasPermission` prefers it over the role matrix.
   */
  permissions?: string[] | null
  /**
   * Server-provided page visibility (Step 3). When present, `canAccessPage`
   * uses this instead of the legacy roleInfo.pages.
   */
  pages?: string[] | null
  /**
   * Server-provided capability flags (Step 3). When present, `can` prefers
   * these over the legacy roleInfo flags.
   */
  capabilities?: {
    canSeeSalary: boolean
    canAddStaff: boolean
    canSeeAudit: boolean
    canBackup: boolean
    canSeeReports: boolean
    canSeeExpenses: boolean
    canManageClinicSettings: boolean
    canManageFinance: boolean
    ownDataOnly: boolean
    readOnly: boolean
  } | null
}

export interface IamResolver {
  /** Legacy capability flags from roleInfo (unchanged behavior). */
  can(capability: IamCapability): boolean
  /** Granular `domain.action` permission check. */
  hasPermission(key: IamPermission): boolean
  /** Whether the active role may open a given page id. */
  canAccessPage(pageId: string | null | undefined): boolean
  /** Page ids the role may open (falls back to [] when unauthenticated). */
  pages: string[]
  /** Resolved role key (may be 'user' when not logged in). */
  role: string
  /** Effective permission keys in the active context. */
  permissions: IamPermission[]
  /** True when the user has no memberships (personal/platform mode). */
  isPersonal: boolean
}

export function createIamResolver(ctx: IamContext): IamResolver {
  const role = String(ctx.role || 'user')
  const roleInfo = ctx.roleInfo || {}

  // Effective permissions: server-provided wins, else the shared role matrix.
  const effective: IamPermission[] = Array.isArray(ctx.permissions)
    ? (Array.from(new Set(ctx.permissions.filter(isIamPermission))) as IamPermission[])
    : permissionsForRole(role)

  // Server-provided pages for page visibility (Step 3), UNION the legacy list.
  //
  // Additive, never a replacement — mirroring `requirePermission` on the
  // backend, which allows when the DB graph OR the role matrix grants. A
  // supplier's Person carries `supplier.manage` + `inventory.read`, which the
  // server maps to pages ['inventory', 'profile']; treating that as the whole
  // truth silently revoked shop / school / diagnostics from the legacy config
  // and bounced them onto a clinic page they cannot open.
  const pages = Array.from(new Set([...(ctx.pages || []), ...(roleInfo.pages || [])]))

  // Server-provided capability flags (Step 3).
  const capabilities = ctx.capabilities || {
    canSeeSalary: !!roleInfo.canSeeSalary,
    canSeeOwnSalary: !!roleInfo.canSeeOwnSalary,
    canSeeSuperAdmin: !!roleInfo.canSeeSuperAdmin,
    canAddStaff: !!roleInfo.canAddStaff,
    canSeeAudit: !!roleInfo.canSeeAudit,
    canBackup: !!roleInfo.canBackup,
    canSeeReports: !!roleInfo.canSeeReports,
    canSeeExpenses: !!roleInfo.canSeeExpenses,
    canManageClinicSettings: !!roleInfo.canManageClinicSettings,
    canManageFinance: !!roleInfo.canManageFinance,
    ownDataOnly: !!roleInfo.ownDataOnly,
    readOnly: !!roleInfo.readOnly,
  }

  const canAccessPage = (pageId: string | null | undefined): boolean => {
    if (!pageId) return true
    if (pages.length === 0) return false
    if (pages.includes(pageId)) return true
    // finance ↔ cashier alias (same CRM Касса surface)
    if (pageId === 'finance' && pages.includes('cashier')) return true
    if (pageId === 'cashier' && pages.includes('finance')) return true
    return false
  }

  return {
    can: (capability) => capabilities[capability as keyof typeof capabilities] ?? false,
    hasPermission: (key) => effective.includes(key),
    canAccessPage,
    pages,
    role,
    permissions: effective,
    isPersonal: !ctx.roleInfo?.pages || ctx.roleInfo.pages.length === 0,
  }
}

function isIamPermission(key: unknown): key is IamPermission {
  return typeof key === 'string' && (Object.values(IAM_PERMISSIONS) as string[]).includes(key)
}
