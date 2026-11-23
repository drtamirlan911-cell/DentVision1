import { describe, expect, it } from 'vitest'

import { createIamResolver } from './resolver'
import { permissionsForRole } from './roleMatrix'
import { IAM_PERMISSIONS } from './permissions'

const LEGACY_PAGES = ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile']

describe('frontend role permission fallback', () => {
  it('includes academy.read in the IAM permission catalogue', () => {
    expect(IAM_PERMISSIONS.ACADEMY_READ).toBe('academy.read')
  })

  it('does not grant platform Academy governance to clinic owners or admins', () => {
    for (const role of ['OWNER', 'DIRECTOR', 'ADMIN']) {
      const permissions = permissionsForRole(role)
      expect(permissions).toContain('academy.read')
      expect(permissions).not.toContain('academy.manage')
    }
  })
})

function resolver(pages: string[] | null | undefined, legacyPages: string[] = LEGACY_PAGES) {
  return createIamResolver({
    role: 'user',
    roleInfo: { pages: legacyPages } as never,
    permissions: [],
    pages,
    capabilities: null,
  })
}

describe('server-provided organization permissions', () => {
  it('preserves recognized partner billing and operational permissions from /me', () => {
    const iam = createIamResolver({
      role: 'user',
      roleInfo: { pages: [] } as never,
      permissions: ['diagnostics.read', 'lab.read', 'lab.write', 'lab.manage', 'billing.read', 'billing.manage', 'staff.read'],
      pages: ['diagnostics'],
    });
    expect(iam.hasPermission('diagnostics.read')).toBe(true);
    expect(iam.hasPermission('lab.read')).toBe(true);
    expect(iam.hasPermission('lab.write')).toBe(true);
    expect(iam.hasPermission('lab.manage')).toBe(true);
    expect(iam.hasPermission('billing.read')).toBe(true);
    expect(iam.hasPermission('billing.manage')).toBe(true);
    expect(iam.hasPermission('staff.read')).toBe(true);
    expect(iam.hasPermission('patient.delete')).toBe(false);
  });
});

describe('canAccessPage — server page policy is authoritative when present', () => {
  it('revokes legacy pages when the server sends a narrower list', () => {
    const iam = resolver(['inventory', 'profile'])

    expect(iam.canAccessPage('shop')).toBe(false)
    expect(iam.canAccessPage('school')).toBe(false)
    expect(iam.canAccessPage('diagnostics')).toBe(false)
    expect(iam.canAccessPage('inventory')).toBe(true)
    expect(iam.canAccessPage('profile')).toBe(true)
  })

  it('falls back to the legacy list only when the server does not provide a page policy', () => {
    expect(resolver(null).canAccessPage('shop')).toBe(true)
    expect(resolver(undefined).canAccessPage('shop')).toBe(true)
  })

  it('denies a page neither source grants', () => {
    expect(resolver(['inventory']).canAccessPage('audit')).toBe(false)
  })

  it('denies everything when both sources are empty', () => {
    const iam = resolver([], [])
    expect(iam.canAccessPage('shop')).toBe(false)
    expect(iam.pages).toEqual([])
  })

  it('keeps the finance ↔ cashier alias', () => {
    expect(resolver(['cashier'], []).canAccessPage('finance')).toBe(true)
    expect(resolver(['finance'], []).canAccessPage('cashier')).toBe(true)
  })

  it('does not duplicate pages supplied by the server', () => {
    const iam = resolver(['shop', 'profile', 'shop'])
    expect(iam.pages.filter((p) => p === 'shop')).toHaveLength(1)
  })
})