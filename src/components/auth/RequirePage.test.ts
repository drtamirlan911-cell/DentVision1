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
