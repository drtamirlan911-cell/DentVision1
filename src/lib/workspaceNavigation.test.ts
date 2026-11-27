import { describe, expect, it } from 'vitest'
import { getWorkspaceHomeTarget, isPartnerWorkspaceType } from './workspaceNavigation'

describe('workspace home navigation', () => {
  it.each([
    ['CLINIC', 'doctor', '/crm/schedule'],
    ['DIAGNOSTIC_CENTER', 'diagnostic_operator', '/diagnostics/center-dashboard'],
    ['LABORATORY', 'medical_lab_technician', '/diagnostics/lab-dashboard'],
    ['LABORATORY', 'dental_technician', '/dental-lab'],
    ['SUPPLIER', 'manager', '/supplier'],
    ['LECTURER', 'lecturer', '/school/workspace'],
    ['ACADEMY', 'academy_owner', '/academy/workspace'],
    ['EMPLOYER', 'employer_recruiter', '/employer'],
    ['PARTNER', 'partner', '/shop'],
  ])('returns the home route for %s / %s', (scopeType, roleKey, path) => {
    expect(getWorkspaceHomeTarget({ scopeType, roleKey })?.path).toBe(path)
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
