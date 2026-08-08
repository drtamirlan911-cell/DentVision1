import { describe, expect, it } from 'vitest'
import {
  computeConsentStatus,
  audienceMatches,
  requiredVersionFor,
  audienceForRole,
  type RequiredConsent,
} from './consent.catalog.js'

const CATALOG: RequiredConsent[] = [
  { type: 'terms', version: '2.0', audience: ['all'], title: 'Terms', mandatory: true },
  { type: 'data', version: '1.0', audience: ['patient'], title: 'Data', mandatory: true },
  { type: 'offer', version: '3.0', audience: ['clinic', 'supplier'], title: 'Offer', mandatory: true },
  { type: 'marketing', version: '1.0', audience: ['all'], title: 'Marketing', mandatory: false },
]

describe('audienceMatches', () => {
  it('matches "all" for any audience', () => {
    expect(audienceMatches(CATALOG[0], 'patient')).toBe(true)
    expect(audienceMatches(CATALOG[0], 'clinic')).toBe(true)
  })
  it('matches only listed audiences otherwise', () => {
    expect(audienceMatches(CATALOG[1], 'patient')).toBe(true)
    expect(audienceMatches(CATALOG[1], 'clinic')).toBe(false)
  })
})

describe('computeConsentStatus', () => {
  it('marks a never-recorded mandatory consent as missing → pending', () => {
    const s = computeConsentStatus(CATALOG, [], 'clinic')
    // clinic sees: terms (all), offer (clinic), marketing (all)
    const terms = s.items.find((i) => i.type === 'terms')!
    expect(terms.status).toBe('missing')
    expect(s.pending).toContain('terms')
    expect(s.pending).toContain('offer')
    expect(s.allSatisfied).toBe(false)
  })

  it('marks an accepted current-version consent as accepted', () => {
    const s = computeConsentStatus(CATALOG, [{ type: 'terms', version: '2.0', accepted: true }], 'all')
    expect(s.items.find((i) => i.type === 'terms')!.status).toBe('accepted')
  })

  it('marks an accepted OLD-version consent as stale → re-acceptance', () => {
    const s = computeConsentStatus(CATALOG, [{ type: 'terms', version: '1.0', accepted: true }], 'all')
    const terms = s.items.find((i) => i.type === 'terms')!
    expect(terms.status).toBe('stale')
    expect(terms.acceptedVersion).toBe('1.0')
    expect(s.pending).toContain('terms')
  })

  it('treats accepted:false as missing', () => {
    const s = computeConsentStatus(CATALOG, [{ type: 'terms', version: '2.0', accepted: false }], 'all')
    expect(s.items.find((i) => i.type === 'terms')!.status).toBe('missing')
  })

  it('excludes consents that do not apply to the audience', () => {
    const s = computeConsentStatus(CATALOG, [], 'clinic')
    expect(s.items.find((i) => i.type === 'data')).toBeUndefined() // patient-only
  })

  it('non-mandatory consents never block allSatisfied', () => {
    const s = computeConsentStatus(CATALOG, [
      { type: 'terms', version: '2.0', accepted: true },
    ], 'patient')
    // patient needs terms + data; marketing is optional
    expect(s.pending).toEqual(['data'])
    const marketing = s.items.find((i) => i.type === 'marketing')!
    expect(marketing.mandatory).toBe(false)
    expect(marketing.status).toBe('missing')
  })

  it('allSatisfied once every mandatory applicable consent is current', () => {
    const s = computeConsentStatus(CATALOG, [
      { type: 'terms', version: '2.0', accepted: true },
      { type: 'offer', version: '3.0', accepted: true },
    ], 'clinic')
    expect(s.allSatisfied).toBe(true)
    expect(s.pending).toEqual([])
  })
})

describe('requiredVersionFor', () => {
  it('returns the catalog version or null', () => {
    // Against the real catalog exports
    expect(requiredVersionFor('terms_of_service')).toBe('1.0')
    expect(requiredVersionFor('nonexistent')).toBeNull()
  })
})

describe('audienceForRole', () => {
  it('maps suppliers, centers, labs, patients, clinics', () => {
    expect(audienceForRole({ organizationType: 'Supplier' })).toBe('supplier')
    expect(audienceForRole({ organizationType: 'DiagnosticCenter' })).toBe('center')
    expect(audienceForRole({ organizationType: 'Laboratory' })).toBe('lab')
    expect(audienceForRole({ role: 'patient' })).toBe('patient')
    expect(audienceForRole({ role: 'owner', organizationType: 'Clinic' })).toBe('clinic')
    expect(audienceForRole({})).toBe('all')
  })
})
