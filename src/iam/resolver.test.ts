import { describe, expect, it } from 'vitest'

import { createIamResolver } from './resolver'

const LEGACY_PAGES = ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile']

function resolver(pages: string[] | null | undefined, legacyPages: string[] = LEGACY_PAGES) {
  return createIamResolver({
    role: 'user',
    roleInfo: { pages: legacyPages } as never,
    permissions: [],
    pages,
    capabilities: null,
  })
}

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