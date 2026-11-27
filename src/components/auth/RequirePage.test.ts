import { describe, expect, it } from 'vitest'
import { isScopedWorkspaceRouteAllowed } from './RequirePage'

describe('partner workspace route authorization', () => {
  it('allows a supplier cabinet only in the active supplier organization', () => {
    expect(isScopedWorkspaceRouteAllowed('supplier', 'SUPPLIER')).toBe(true)
    expect(isScopedWorkspaceRouteAllowed('supplier', 'SUPPLIER_COMPANY')).toBe(true)
    expect(isScopedWorkspaceRouteAllowed('supplier', 'CLINIC')).toBe(false)
    expect(isScopedWorkspaceRouteAllowed('supplier', 'EMPLOYER')).toBe(false)
    expect(isScopedWorkspaceRouteAllowed('supplier', null)).toBe(false)
  })

  it('allows the lecturer workspace only in an active lecturer context', () => {
    expect(isScopedWorkspaceRouteAllowed('school', 'LECTURER')).toBe(true)
    expect(isScopedWorkspaceRouteAllowed('school', 'ACADEMY')).toBe(false)
    expect(isScopedWorkspaceRouteAllowed('school', 'CLINIC')).toBe(false)
  })

  it('allows diagnostic finance only at the route granted to the active role', () => {
    expect(isScopedWorkspaceRouteAllowed(
      'diagnostics', 'DIAGNOSTIC_CENTER', 'diagnostic_finance',
      '/diagnostics/center', '?tab=cashier',
    )).toBe(true)
    expect(isScopedWorkspaceRouteAllowed(
      'diagnostics', 'DIAGNOSTIC_CENTER', 'diagnostic_reception',
      '/diagnostics/results', '',
    )).toBe(false)
  })

  it('allows QC specialists into the dental-lab QC queue but not into another role tab', () => {
    expect(isScopedWorkspaceRouteAllowed(
      'diagnostics', 'LABORATORY', 'qc_specialist',
      '/diagnostics/lab', '?workspace=dental-lab&tab=quality',
    )).toBe(true)
    expect(isScopedWorkspaceRouteAllowed(
      'diagnostics', 'LABORATORY', 'dental_technician',
      '/diagnostics/lab', '?workspace=dental-lab&tab=quality',
    )).toBe(false)
  })

  it('allows an employer cabinet only in employer or explicitly supported clinic context', () => {
    expect(isScopedWorkspaceRouteAllowed('employer', 'EMPLOYER')).toBe(true)
    expect(isScopedWorkspaceRouteAllowed('employer', 'CLINIC')).toBe(true)
    expect(isScopedWorkspaceRouteAllowed('employer', 'SUPPLIER')).toBe(false)
    expect(isScopedWorkspaceRouteAllowed('employer', null)).toBe(false)
  })

  it('does not turn partner context into access to unrelated pages', () => {
    expect(isScopedWorkspaceRouteAllowed('admin', 'SUPPLIER')).toBe(false)
    expect(isScopedWorkspaceRouteAllowed('crm/patients', 'EMPLOYER')).toBe(false)
  })
})
