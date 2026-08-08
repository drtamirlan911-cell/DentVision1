import { describe, expect, it } from 'vitest'

import { createIamResolver } from './resolver'

/** What PLATFORM_ROLES.user grants a supplier / lecturer today. */
const LEGACY_PAGES = ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile']

function resolver(pages: string[] | null, legacyPages: string[] = LEGACY_PAGES) {
  return createIamResolver({
    role: 'user',
    roleInfo: { pages: legacyPages } as never,
    permissions: [],
    pages,
    capabilities: null,
  })
}

describe('canAccessPage — server pages are additive', () => {
  it('does not revoke legacy pages when the server sends a narrower list', () => {
    // A supplier's Person carries supplier.manage + inventory.read, which the
    // server maps to ['inventory', 'profile']. Treating that as the whole truth
    // locked them out of shop / school / diagnostics and bounced them onto a
    // clinic page they cannot open.
    const iam = resolver(['inventory', 'profile'])

    expect(iam.canAccessPage('shop')).toBe(true)
    expect(iam.canAccessPage('school')).toBe(true)
    expect(iam.canAccessPage('diagnostics')).toBe(true)
    // …while what the server added is granted too.
    expect(iam.canAccessPage('inventory')).toBe(true)
  })

  it('falls back to the legacy list when the server sends nothing', () => {
    expect(resolver([]).canAccessPage('shop')).toBe(true)
    expect(resolver(null).canAccessPage('shop')).toBe(true)
  })

  it('still denies a page neither source grants', () => {
    expect(resolver(['inventory']).canAccessPage('audit')).toBe(false)
  })

  it('denies everything only when both sources are empty', () => {
    const iam = resolver([], [])
    expect(iam.canAccessPage('shop')).toBe(false)
    expect(iam.pages).toEqual([])
  })

  it('keeps the finance ↔ cashier alias', () => {
    expect(resolver(['cashier'], []).canAccessPage('finance')).toBe(true)
    expect(resolver(['finance'], []).canAccessPage('cashier')).toBe(true)
  })

  it('does not duplicate pages present in both sources', () => {
    const iam = resolver(['shop', 'profile'])
    expect(iam.pages.filter((p) => p === 'shop')).toHaveLength(1)
  })
})
