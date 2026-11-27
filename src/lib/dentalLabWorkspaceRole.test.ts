import { describe, expect, it } from 'vitest'
import { hasDentalLabRole, resolveDentalLabRoleCapabilities } from './dentalLabWorkspaceRole'

describe('dental-lab role capabilities', () => {
  it('maps canonical owner and manager roles to the full management workspace', () => {
    const owner = resolveDentalLabRoleCapabilities('dental_lab_owner')
    const manager = resolveDentalLabRoleCapabilities('dental_lab_manager')
    expect(owner.canManageQc).toBe(true)
    expect(owner.canPerformQc).toBe(true)
    expect(owner.canManageFinance).toBe(true)
    expect(manager.canManageShipping).toBe(true)
    expect(manager.canReadProduction).toBe(true)
  })

  it('gives a canonical dental technician production and materials only', () => {
    expect(resolveDentalLabRoleCapabilities('dental_lab_technician')).toEqual({
      canManageQc: false,
      canPerformQc: false,
      canManageShipping: false,
      canManageFinance: false,
      canReadProduction: true,
      canConsumeMaterials: true,
      canReadOrders: true,
    })
  })

  it('allows QC specialists to complete quality checks without granting team or finance management', () => {
    const access = resolveDentalLabRoleCapabilities('qc_specialist')
    expect(access).toEqual({
      canManageQc: false,
      canPerformQc: true,
      canManageShipping: false,
      canManageFinance: false,
      canReadProduction: true,
      canConsumeMaterials: false,
      canReadOrders: true,
    })
  })

  it('isolates a finance-only employee from production and shipping', () => {
    expect(resolveDentalLabRoleCapabilities('lab_finance')).toEqual({
      canManageQc: false,
      canPerformQc: false,
      canManageShipping: false,
      canManageFinance: true,
      canReadProduction: false,
      canConsumeMaterials: false,
      canReadOrders: false,
    })
  })

  it('keeps delivery staff limited to ready and delivered order work', () => {
    expect(resolveDentalLabRoleCapabilities('courier')).toEqual({
      canManageQc: false,
      canPerformQc: false,
      canManageShipping: true,
      canManageFinance: false,
      canReadProduction: false,
      canConsumeMaterials: false,
      canReadOrders: true,
    })
  })

  it('supports multiple role memberships without discarding either capability', () => {
    expect(hasDentalLabRole('dental_lab_technician,lab_finance', 'lab_finance')).toBe(true)
    const access = resolveDentalLabRoleCapabilities('dental_lab_technician,lab_finance')
    expect(access.canReadProduction).toBe(true)
    expect(access.canManageFinance).toBe(true)
  })
})
