import { describe, expect, it } from 'vitest'
import {
  canAccessPage,
  firstAllowedCrmPath,
  pageIdFromPath,
} from './roleAccess'

describe('roleAccess', () => {
  it('maps CRM and secondary workspace paths to page ids', () => {
    expect(pageIdFromPath('/crm/finance')).toBe('finance')
    expect(pageIdFromPath('/crm/medical-card')).toBe('medical-card')
    expect(pageIdFromPath('/crm/integrations/messaging')).toBe('clinic-settings')
    expect(pageIdFromPath('/supplier')).toBe('supplier')
    expect(pageIdFromPath('/shop/orders')).toBe('shop')
  })

  it('maps real diagnostics routes to their IAM page ids', () => {
    expect(pageIdFromPath('/diagnostics/labs')).toBe('diagnostics-labs')
    expect(pageIdFromPath('/diagnostics/registration-requests')).toBe('admin')
    expect(pageIdFromPath('/diagnostics/center')).toBe('diagnostics')
    expect(pageIdFromPath('/diagnostics/lab')).toBe('diagnostics')
    expect(pageIdFromPath('/diagnostics/center-dashboard')).toBe('diagnostics')
    expect(pageIdFromPath('/diagnostics/lab-dashboard')).toBe('diagnostics')
  })

  it('allows doctor clinical pages only', () => {
    const doctor = ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'lab', 'reminders', 'school', 'treatment-plans', 'dental-chart']
    expect(canAccessPage(doctor, 'schedule')).toBe(true)
    expect(canAccessPage(doctor, 'finance')).toBe(false)
    expect(canAccessPage(doctor, 'staff')).toBe(false)
    expect(canAccessPage(doctor, 'inventory')).toBe(false)
    expect(canAccessPage(doctor, 'billing')).toBe(false)
  })

  it('treats finance and cashier as aliases', () => {
    expect(canAccessPage(['cashier'], 'finance')).toBe(true)
    expect(canAccessPage(['finance'], 'cashier')).toBe(true)
  })

  it('assistant cannot open medical-card / lab', () => {
    const assistant = ['schedule', 'patients', 'visits', 'documents', 'reminders', 'shop', 'school']
    expect(canAccessPage(assistant, 'medical-card')).toBe(false)
    expect(canAccessPage(assistant, 'lab')).toBe(false)
    expect(canAccessPage(assistant, 'schedule')).toBe(true)
  })

  it('picks first allowed CRM fallback', () => {
    expect(firstAllowedCrmPath(['patients', 'documents'])).toBe('/crm/patients')
    expect(firstAllowedCrmPath([])).toBe('/')
  })
})
