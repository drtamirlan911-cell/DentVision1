import { describe, expect, it } from 'vitest'
import {
  getWorkspaceHomeTarget,
  getWorkspaceNavigationGroups,
  isPartnerWorkspaceType,
  isWorkspaceNavigationActive,
  resolveWorkspaceTab,
} from './workspaceNavigation'

describe('workspace tab resolution', () => {
  it('opens the requested tab when that tab is available to the active role', () => {
    expect(resolveWorkspaceTab('finance', ['worklist', 'finance'], 'worklist')).toBe('finance')
  })

  it('falls back when the requested tab is not permitted for the active role', () => {
    expect(resolveWorkspaceTab('finance', ['worklist', 'referrals'], 'worklist')).toBe('worklist')
  })

  it('uses a safe role-specific fallback when there is no requested tab', () => {
    expect(resolveWorkspaceTab(null, ['worklist', 'referrals'], 'worklist')).toBe('worklist')
  })
})

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

  it('gives a clinic doctor a focused appointment and clinical-record menu', () => {
    const items = getWorkspaceNavigationGroups('CLINIC', 'clinic.doctor').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'schedule', 'patients', 'visits', 'medical-card', 'dental-chart', 'treatment-plans',
    ]))
    expect(items.some((entry) => ['staff', 'inventory', 'clinic-settings', 'cashier'].includes(entry.id))).toBe(false)
  })

  it('keeps a clinic assistant focused on the daily front-desk workflow', () => {
    const items = getWorkspaceNavigationGroups('CLINIC', 'clinic.assistant').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['schedule', 'patients', 'visits'])
  })

  it('exposes clinic administration and finance sections to an owner', () => {
    const items = getWorkspaceNavigationGroups('CLINIC', 'clinic.owner').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'schedule', 'patients', 'visits', 'staff', 'inventory', 'pricelist', 'clinic-settings', 'analytics', 'cashier', 'billing',
    ]))
  })

  it('keeps a clinic cashier in the finance workflow', () => {
    const items = getWorkspaceNavigationGroups('CLINIC', 'clinic.cashier').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['cashier', 'billing'])
  })

  it('gives a diagnostic finance employee direct access to settlements without operational clutter', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_finance').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['finance'])
    expect(items[0].path).toBe('/diagnostics/center?tab=finance')
  })

  it('shows operational work and finance to a diagnostic-centre owner', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_owner').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'queue', 'referrals', 'results', 'calendar', 'analytics', 'settings', 'finance', 'cashier',
    ]))
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

  it('gives a dental-lab QC specialist a dedicated QC queue without management tabs', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'qc_specialist').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['priority', 'materials', 'quality'])
    expect(items.find((entry) => entry.id === 'quality')?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab&tab=quality')
    expect(items.some((entry) => ['team', 'services', 'finance', 'shipping'].includes(entry.id))).toBe(false)
  })

  it('gives a dental-lab finance specialist the finance tab without production controls', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'lab_finance').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['finance'])
  })

  it('shows read-only finance to medical-lab reception because the role grants finance.read', () => {
    const items = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_reception').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['orders', 'finance'])
  })

  it('shows read-only settlements to diagnostic-centre reception with finance.read', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_reception').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toContain('finance')
    expect(items.map((entry) => entry.id)).toContain('queue')
  })

  it('keeps medical-lab operations and finance separate by employee role', () => {
    const technician = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_technician').flatMap((entry) => entry.items)
    const finance = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_finance').flatMap((entry) => entry.items)
    const owner = getWorkspaceNavigationGroups('LABORATORY', 'medical_lab_owner').flatMap((entry) => entry.items)
    expect(technician.map((entry) => entry.id)).toEqual(['orders'])
    expect(finance.map((entry) => entry.id)).toEqual(['finance'])
    expect(owner.map((entry) => entry.id)).toEqual(['orders', 'finance'])
  })

  it('shows only implemented Academy courses, learner and team sections', () => {
    const items = getWorkspaceNavigationGroups('ACADEMY', 'academy_owner').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.path)).toEqual([
      '/academy/workspace?tab=courses',
      '/academy/workspace?tab=students',
      '/academy/workspace?section=team',
    ])
    expect(items.some((entry) => ['finance', 'content', 'assessments', 'certificates', 'schedule', 'analytics'].includes(entry.id))).toBe(false)
  })

  it('marks query-backed sections active only when their query value matches', () => {
    expect(isWorkspaceNavigationActive('/supplier', '?tab=sales', '/supplier?tab=sales')).toBe(true)
    expect(isWorkspaceNavigationActive('/supplier', '?tab=stock', '/supplier?tab=sales')).toBe(false)
    expect(isWorkspaceNavigationActive('/supplier', '?tab=stock', '/supplier')).toBe(false)
    expect(isWorkspaceNavigationActive('/supplier', '?tab=stock', '/supplier', { matchAllTabs: true })).toBe(true)
    expect(isWorkspaceNavigationActive('/supplier', '?organizationId=org-1', '/supplier')).toBe(true)
  })

  it('does not highlight a dashboard base link when another diagnostic tab is active', () => {
    expect(isWorkspaceNavigationActive('/diagnostics/center', '?tab=finance', '/diagnostics/center')).toBe(false)
    expect(isWorkspaceNavigationActive('/diagnostics/center', '?tab=finance', '/diagnostics/center?tab=finance')).toBe(true)
  })
})
