import { describe, expect, it } from 'vitest'
import { IAM_PERMISSIONS } from './permissions'
import {
  normalizeBackendRole,
  permissionsForBackendRole,
  permissionsForRole,
  isPlatformOnlyPermission,
} from './roleMatrix'
import { createIamResolver, type IamRoleInfo } from './resolver'
import { ORG_ROLES, PLATFORM_ROLES } from '@/store/auth.store'

const makeRoleInfo = (role: string): IamRoleInfo | null =>
  ORG_ROLES[role] || PLATFORM_ROLES[role] || null

describe('roleMatrix — normalizeBackendRole', () => {
  it('maps frontend roles to backend enum', () => {
    expect(normalizeBackendRole('owner')).toBe('OWNER')
    expect(normalizeBackendRole('director')).toBe('DIRECTOR')
    expect(normalizeBackendRole('admin')).toBe('ADMIN')
    expect(normalizeBackendRole('cashier')).toBe('ADMIN')
    expect(normalizeBackendRole('doctor')).toBe('DOCTOR')
    expect(normalizeBackendRole('assistant')).toBe('ASSISTANT')
    expect(normalizeBackendRole('intern')).toBe('STUDENT')
    expect(normalizeBackendRole('lab')).toBe('LAB')
    expect(normalizeBackendRole('laboratory')).toBe('LAB')
    expect(normalizeBackendRole('superadmin')).toBe('SUPERADMIN')
  })

  it('is case-insensitive and null-safe', () => {
    expect(normalizeBackendRole('OWNER')).toBe('OWNER')
    expect(normalizeBackendRole('')).toBeNull()
    expect(normalizeBackendRole(null)).toBeNull()
    expect(normalizeBackendRole(undefined)).toBeNull()
  })
})

describe('roleMatrix — permission matrix mirrors backend', () => {
  it('superadmin is wildcard over the full catalog', () => {
    const all = permissionsForBackendRole('SUPERADMIN')
    expect(all).toEqual(expect.arrayContaining(Object.values(IAM_PERMISSIONS)))
  })

  it('owner/director/admin get finance + settings permissions', () => {
    for (const role of ['OWNER', 'DIRECTOR', 'ADMIN'] as const) {
      expect(permissionsForBackendRole(role)).toContain('finance.manage')
      expect(permissionsForBackendRole(role)).toContain('bi.clinic')
      expect(permissionsForBackendRole(role)).toContain('patient.delete')
    }
  })

  it('doctor has clinical read/write but no finance', () => {
    const p = permissionsForBackendRole('DOCTOR')
    expect(p).toContain('patient.read')
    expect(p).toContain('appointment.write')
    expect(p).not.toContain('finance.manage')
    expect(p).not.toContain('patient.delete')
  })

  it('assistant has read-only clinical access', () => {
    const p = permissionsForBackendRole('ASSISTANT')
    expect(p).toContain('patient.read')
    expect(p).toContain('appointment.read')
    expect(p).not.toContain('patient.write')
    expect(p).not.toContain('inventory.write')
  })

  it('platform-only permissions are restricted to superadmin', () => {
    expect(isPlatformOnlyPermission('platform.analytics')).toBe(true)
    expect(isPlatformOnlyPermission('bi.platform')).toBe(true)
    expect(isPlatformOnlyPermission('compliance.manage')).toBe(true)
    expect(isPlatformOnlyPermission('patient.read')).toBe(false)
    expect(permissionsForBackendRole('OWNER')).not.toContain('platform.analytics')
    expect(permissionsForBackendRole('SUPERADMIN')).toContain('platform.analytics')
  })

  it('frontend role string delegates to matrix', () => {
    expect(permissionsForRole('doctor')).toContain('appointment.write')
    expect(permissionsForRole('admin')).toContain('finance.manage')
    expect(permissionsForRole('')).toEqual([])
  })
})

describe('resolver — behavior parity with legacy role config', () => {
  it('resolves pages from the legacy role config unchanged', () => {
    for (const role of Object.keys(ORG_ROLES)) {
      const r = createIamResolver({ role, roleInfo: makeRoleInfo(role) })
      const legacy = makeRoleInfo(role)!
      expect(r.pages).toEqual(legacy.pages || [])
      expect(r.role).toBe(role)
    }
  })

  it('doctor cannot open finance, can open schedule', () => {
    const r = createIamResolver({ role: 'doctor', roleInfo: makeRoleInfo('doctor') })
    expect(r.canAccessPage('schedule')).toBe(true)
    expect(r.canAccessPage('finance')).toBe(false)
    expect(r.canAccessPage('staff')).toBe(false)
  })

  it('admin opens finance and clinic-settings', () => {
    const r = createIamResolver({ role: 'admin', roleInfo: makeRoleInfo('admin') })
    expect(r.canAccessPage('finance')).toBe(true)
    expect(r.canAccessPage('clinic-settings')).toBe(true)
  })

  it('finance ↔ cashier alias preserved', () => {
    const r = createIamResolver({ role: 'admin', roleInfo: makeRoleInfo('admin') })
    expect(r.canAccessPage('cashier')).toBe(true)
  })

  it('legacy capability flags work through can()', () => {
    const owner = createIamResolver({ role: 'owner', roleInfo: makeRoleInfo('owner') })
    expect(owner.can('canManageClinicSettings')).toBe(true)
    expect(owner.can('canAddStaff')).toBe(true)

    const doctor = createIamResolver({ role: 'doctor', roleInfo: makeRoleInfo('doctor') })
    expect(doctor.can('ownDataOnly')).toBe(true)
    expect(doctor.can('canManageClinicSettings')).toBe(false)
  })

  it('hasPermission follows the shared matrix by role', () => {
    const admin = createIamResolver({ role: 'admin', roleInfo: makeRoleInfo('admin') })
    expect(admin.hasPermission('finance.manage')).toBe(true)
    expect(admin.hasPermission('bi.clinic')).toBe(true)

    const doctor = createIamResolver({ role: 'doctor', roleInfo: makeRoleInfo('doctor') })
    expect(doctor.hasPermission('finance.manage')).toBe(false)
    expect(doctor.hasPermission('appointment.write')).toBe(true)
  })

  it('prefers server-provided permissions over the role matrix', () => {
    // Simulate Step 2: backend sends effective permissions for the context.
    const r = createIamResolver({
      role: 'doctor',
      roleInfo: makeRoleInfo('doctor'),
      permissions: ['finance.manage'],
    })
    expect(r.hasPermission('finance.manage')).toBe(true)
    // Matrix fallback must NOT leak extra rights when server speaks.
    expect(r.hasPermission('appointment.delete')).toBe(false)
  })

  it('superadmin is allowed everywhere via matrix', () => {
    const r = createIamResolver({ role: 'superadmin', roleInfo: makeRoleInfo('superadmin') })
    expect(r.hasPermission('platform.analytics')).toBe(true)
    expect(r.hasPermission('bi.platform')).toBe(true)
    expect(r.can('canSeeSuperAdmin')).toBe(true)
  })

  it('unauthenticated resolver is denied by default', () => {
    const r = createIamResolver({ role: 'user', roleInfo: null })
    expect(r.pages).toEqual([])
    expect(r.hasPermission('patient.read')).toBe(false)
    expect(r.canAccessPage('schedule')).toBe(false)
    expect(r.isPersonal).toBe(true)
  })
})
