/**
 * IAM resolver — single access-decision point for the frontend.
 * Server-provided permissions/pages/capabilities are authoritative whenever present.
 */

import type { IamPermission } from './permissions'
import { IAM_PERMISSIONS } from './permissions'
import { permissionsForRole } from './roleMatrix'

export type IamCapability =
  | 'canSeeSalary' | 'canSeeOwnSalary' | 'canSeeSuperAdmin' | 'canAddStaff'
  | 'canSeeAudit' | 'canBackup' | 'canSeeReports' | 'canSeeExpenses'
  | 'canManageClinicSettings' | 'canManageFinance' | 'ownDataOnly' | 'readOnly'

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
  permissions?: string[] | null
  pages?: string[] | null
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
  can(capability: IamCapability): boolean
  hasPermission(key: IamPermission): boolean
  canAccessPage(pageId: string | null | undefined): boolean
  pages: string[]
  role: string
  permissions: IamPermission[]
  isPersonal: boolean
}

export function createIamResolver(ctx: IamContext): IamResolver {
  const role = String(ctx.role || 'user')
  const roleInfo = ctx.roleInfo || {}
  const effective: IamPermission[] = Array.isArray(ctx.permissions)
    ? (Array.from(new Set(ctx.permissions.filter(isIamPermission))) as IamPermission[])
    : permissionsForRole(role)

  // When the backend sends pages, they are authoritative. Legacy pages are used
  // only when the server has not supplied a page policy at all.
  const pages = Array.isArray(ctx.pages)
    ? Array.from(new Set(ctx.pages))
    : Array.from(new Set(roleInfo.pages || []))

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
