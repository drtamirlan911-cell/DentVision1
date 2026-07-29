/**
 * Frontend AI platform map smoke tests.
 */
import { describe, expect, it } from 'vitest'
import { AI_NAV_ACTIONS, getSmartSuggestions, stageFromPath } from './aiPlatformMap'

describe('aiPlatformMap', () => {
  it('maps Open* actions for full CRM surface', () => {
    expect(AI_NAV_ACTIONS.OpenPriceList).toBe('/crm/pricelist')
    expect(AI_NAV_ACTIONS.OpenSupplier).toBe('/supplier')
    expect(AI_NAV_ACTIONS.OpenICD10).toBe('/crm/icd10')
    expect(AI_NAV_ACTIONS.OpenBilling).toBe('/crm/billing')
  })

  it('infers stage and role chips', () => {
    expect(stageFromPath('/crm/finance')).toBe('finance')
    const owner = getSmartSuggestions({ user: { role: 'owner' }, pathname: '/crm/schedule' })
    expect(owner.some((s) => /сегодня|записать|выручк|долг|карта/i.test(s))).toBe(true)
    const guest = getSmartSuggestions({ guest: true })
    expect(guest[0]).toMatch(/DentVision|демо|Academy|карта/i)
  })
})
