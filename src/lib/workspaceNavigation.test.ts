import { describe, expect, it } from 'vitest'
import {
  getWorkspaceHomeTarget,
  getWorkspaceNavigationGroups,
  isPartnerWorkspaceType,
  isWorkspaceNavigationActive,
  isClinicFinanceOnlyRole,
  resolveWorkspaceTab,
  resolveWorkspaceRoleLabel,
} from './workspaceNavigation'

describe('selected workspace role labels', () => {
  const labels: Record<string, string> = {
    qc_specialist: 'Контроль качества лаборатории',
    dental_lab_owner: 'Владелец зуботехнической лаборатории',
    doctor: 'Врач',
    owner: 'Владелец',
  }

  it('prefers the active membership role over a stale saved label', () => {
    expect(resolveWorkspaceRoleLabel(
      'qc_specialist',
      'owner',
      'Владелец',
      (role) => labels[role] || role,
    )).toBe('Контроль качества лаборатории')
  })

  it('uses the legacy scoped membership role when roleKey is absent', () => {
    expect(resolveWorkspaceRoleLabel(
      null,
      'qc_specialist',
      'Сотрудник',
      (role) => labels[role] || role,
    )).toBe('Контроль качества лаборатории')
  })

  it('falls back to the saved scoped role label when the role key is not mapped', () => {
    expect(resolveWorkspaceRoleLabel(
      'supplier_stock_controller',
      null,
      'Контролёр остатков',
      (role) => labels[role] || role,
    )).toBe('Контролёр остатков')
  })
})

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

describe('clinic role home resolution', () => {
  it('recognizes a finance-only cashier role even when expressed as an organization-scoped key', () => {
    expect(isClinicFinanceOnlyRole('clinic.cashier')).toBe(true)
    expect(isClinicFinanceOnlyRole('clinic.finance')).toBe(true)
  })

  it('does not classify a manager who also has finance access as finance-only', () => {
    expect(isClinicFinanceOnlyRole('clinic.owner,clinic.finance')).toBe(false)
    expect(isClinicFinanceOnlyRole('clinic.admin')).toBe(false)
  })
})

describe('workspace home navigation', () => {
  it.each([
    ['CLINIC', 'doctor', '/crm/schedule'],
    ['DIAGNOSTIC_CENTER', 'diagnostic_operator', '/diagnostics/center?tab=worklist'],
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

  it('returns medical-lab finance staff directly to finances', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'medical_lab_finance' })?.path)
      .toBe('/diagnostics/lab?workspace=medical-lab&tab=finance')
  })

  it('returns dental-lab QC staff directly to the quality queue', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'qc_specialist' })?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab&tab=quality')
  })

  it('returns dental technicians to assigned priority work', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'dental_technician' })?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab&tab=priority')
  })

  it('returns dental-lab finance staff to the finance workspace', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'LABORATORY', roleKey: 'lab_finance' })?.path)
      .toBe('/diagnostics/lab?workspace=dental-lab&tab=finance')
  })

  it('returns diagnostic finance staff to the finance workspace', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'DIAGNOSTIC_CENTER', roleKey: 'diagnostic_finance' })?.path)
      .toBe('/diagnostics/center?tab=cashier')
  })

  it('returns diagnostic quality staff to results, not a generic dashboard', () => {
    expect(getWorkspaceHomeTarget({ scopeType: 'DIAGNOSTIC_CENTER', roleKey: 'diagnostic_quality' })?.path)
      .toBe('/diagnostics/results')
  })

  it('gives employer recruiters a candidate-focused menu', () => {
    const items = getWorkspaceNavigationGroups('EMPLOYER', 'employer_recruiter').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.label)).toEqual(['Отклики и собеседования', 'Рынок специалистов'])
  })

  it('keeps employer viewers on vacancy and hiring status monitoring', () => {
    const items = getWorkspaceNavigationGroups('EMPLOYER', 'employer_viewer').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['vacancies'])
    expect(items[0].label).toBe('Вакансии и этапы подбора')
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
    expect(items.map((entry) => entry.id)).toEqual(['cashier', 'finance', 'analytics'])
    expect(items[0].path).toBe('/diagnostics/center?tab=cashier')
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

  it('keeps a diagnostic finance employee in cashier, settlements and analytics only', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_finance').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['cashier', 'finance', 'analytics'])
    expect(items.some((entry) => ['queue', 'referrals', 'results', 'calendar', 'settings'].includes(entry.id))).toBe(false)
  })

  it('keeps diagnostic reception on incoming registrations and permitted read-only finance', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_reception').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['queue', 'referrals', 'finance'])
    expect(items.some((entry) => ['results', 'calendar', 'settings'].includes(entry.id))).toBe(false)
  })

  it('does not expose the diagnostic cashier to an admin with billing read but no billing manage', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_admin').flatMap((entry) => entry.items)
    expect(items.some((entry) => entry.id === 'cashier')).toBe(false)
    expect(items.some((entry) => entry.id === 'settings')).toBe(true)
  })

  it('directs diagnostic quality staff to results and analytics, not reception tasks', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'diagnostic_quality').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['results', 'analytics'])
  })

  it('directs radiologists to assigned studies and their results', () => {
    const items = getWorkspaceNavigationGroups('DIAGNOSTIC_CENTER', 'radiologist').flatMap((entry) => entry.items)
    expect(items.map((entry) => entry.id)).toEqual(['queue', 'referrals', 'results'])
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
