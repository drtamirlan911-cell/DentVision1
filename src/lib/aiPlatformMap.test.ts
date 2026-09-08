/**
 * Frontend AI platform map smoke tests.
 */
import { describe, expect, it } from 'vitest'
import { AI_NAV_ACTIONS, getSmartSuggestions, stageFromPath } from './aiPlatformMap'

describe('aiPlatformMap', () => {
  it('maps Open* actions to canonical application routes', () => {
    expect(AI_NAV_ACTIONS.OpenSchedule).toBe('/crm/schedule')
    expect(AI_NAV_ACTIONS.OpenPatients).toBe('/crm/patients')
    expect(AI_NAV_ACTIONS.OpenPriceList).toBe('/crm/pricelist')
    expect(AI_NAV_ACTIONS.OpenSupplier).toBe('/supplier')
    expect(AI_NAV_ACTIONS.OpenICD10).toBe('/crm/icd10')
    expect(AI_NAV_ACTIONS.OpenCashier).toBe('/crm/cashier')
    expect(AI_NAV_ACTIONS.OpenFinance).toBe('/crm/cashier')
    expect(AI_NAV_ACTIONS.OpenInvoice).toBe('/crm/cashier')
  })

  it('infers stage and role chips', () => {
    expect(stageFromPath('/crm/cashier')).toBe('finance')
    expect(stageFromPath('/crm/finance')).not.toBe('finance')
    const owner = getSmartSuggestions({ user: { role: 'owner' }, pathname: '/crm/schedule' })
    expect(owner.some((s) => /сегодня|записать|выручк|долг|карта/i.test(s))).toBe(true)
    const guest = getSmartSuggestions({ guest: true })
    expect(guest[0]).toMatch(/DentVision|демо|Academy|карта/i)
  })

  it('prioritizes patient context over the current route', () => {
    const suggestions = getSmartSuggestions({
      user: { role: 'doctor' },
      pathname: '/crm/schedule',
      focusType: 'patient',
    })
    expect(suggestions).toEqual(['История лечения', 'План лечения', 'Зубная карта', 'Записать на приём'])
  })
})
