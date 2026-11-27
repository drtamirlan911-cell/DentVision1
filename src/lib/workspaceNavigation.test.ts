import { describe, expect, it } from 'vitest'
import {
  getWorkspaceHomeTarget,
  getWorkspaceNavigationGroups,
  isPartnerWorkspaceType,
  isWorkspaceNavigationActive,
} from './workspaceNavigation'

describe('workspace home navigation', () => {
  it.each([
    ['CLINIC', 'doctor', '/crm/schedule'],
    ['DIAGNOSTIC_CENTER', 'diagnostic_operator', '/diagnostics/center'],
    ['SUPPLIER', 'manager', '/supplier'],
    ['LECTURER', 'lecturer', '/school/workspace'],
    ['ACADEMY', 'academy_owner', '/academy/workspace'],
    ['EMPLOYER', 'employer_recruiter', '/employer'],
    ['PARTNER', 'partner', '/shop'],
  ])('returns the home route for %s / %s', (scopeType, roleKey, path) => {
    expect(getWorkspaceHomeTarget({ scopeType, roleKey })?.path).toBe(path)
  })

  it('resolves medical and dental laboratory homes from the scoped role, not the legacy OWNER role', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'medical_lab_technician', role: 'owner' })?.path)
      .toBe('/diagnostics/lab?workspace=medical-lab')
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'dental_lab_owner', role: 'owner' })?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab')
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'laboratory_manager,medical_lab_validator' })?.path)
      .toBe('/diagnostics/lab?workspace=medical-lab')
  })

  it('returns a dental-lab home for the legacy mixed technician membership payload', () => {
    expect(getWorkspaceHomeTarget({
      scopeType: 'LABORATORY',
      roleKey: 'laboratory_technician,medical_lab_technician,dental_technician',
    })?.path).toBe('/diagnostics/lab?workspace=dental-lab')
  })

  it('does not guess a workspace when the active identity is ambiguous', () => {
    expect(getWorkspaceHomeTarget({})).toBeNull()
  })

  it('recognises every non-clinic organization workspace as a partner workspace', () => {
    expect(isPartnerWorkspaceType('SUPPLIER')).toBe(true)
    expect(isPartnerWorkspaceType('LABORATORY')).toBe(true)
    expect(isPartnerWorkspaceType('CLINIC')).toBe(false)
    expect(isPartnerWorkspaceType(null)).toBe(false)
  })
})

describe('role-aware workspace navigation', () => {
  it('exposes operational supplier tabs as direct sidebar destinations', () => {
    const items = getWorkspaceNavigationGroups('SUPPLIER', 'supplier.seller').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.path)).toContain('/supplier?tab=sales')
    expect(items.map((entry) => entry.path)).toContain('/supplier?tab=stock')
    expect(items.map((entry) => entry.path)).toContain('/supplier?tab=returns')
  })

  it('separates medical-lab finance from the technician workflow', () => {
    const technician = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_technician').flatMap((entry) => entry.items)
    const owner = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_owner').flatMap((entry) => entry.items)
    expect(technician.some((entry) => entry.id === 'finance')).toBe(false)
    expect(owner.some((entry) => entry.id === 'finance')).toBe(true)
  })

  it('exposes production, management, shipping and finance sections to a dental-lab manager', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'dental_lab_manager').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'priority', 'materials', 'team', 'services', 'shipping', 'finance',
    ]))
    expect(items.find((entry) => entry.id === 'team')?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab&tab=team')
  })

  it('keeps dental technicians in assigned production work without exposing management or finance tabs', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'dental_technician').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['priority', 'materials'])
    expect(items.some((entry) => entry.id === 'team' || entry.id === 'finance')).toBe(false)
  })

  it('gives a dental-lab finance specialist the finance tab without production controls', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'lab_finance').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['finance'])
  })

  it('keeps medical-lab operations and finance separate by employee role', () => {
    const technician = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_technician').flatMap((entry) => entry.items)
    const finance = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_finance').flatMap((entry) => entry.items)
    const owner = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_owner').flatMap((entry) => entry.items)
    expect(technician.map((entry) => entry.id)).toEqual(['orders'])
    expect(finance.map((entry) => entry.id)).toEqual(['finance'])
    expect(owner.map((entry) => entry.id)).toEqual(['orders', 'finance'])
  })

  it('provides owner navigation for Academy sections already supported by the URL', () => {
    const items = getWorkspaceNavigationGroups('ACADEMY', 'academy_owner').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.path)).toContain('/academy/workspace?tab=students')
    expect(items.map((entry) => entry.path)).toContain('/academy/workspace?section=finance')
  })

  it('marks query-backed sections active only when their query value matches', () => {
    expect(isWorkspaceNavigationActive('/supplier', '?tab=sales', '/supplier?tab=sales')).toBe(true)
    expect(isWorkspaceNavigationActive('/supplier', '?tab=stock', '/supplier?tab=sales')).toBe(false)
    expect(isWorkspaceNavigationActive('/supplier', '?tab=stock', '/supplier')).toBe(true)
  })
})
