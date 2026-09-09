/**
 * Role-based CRM / platform page access helpers.
 * Source of truth: ORG_ROLES / PLATFORM_ROLES in auth.store.
 */
export const PATH_PAGE_ID: Record<string, string> = {
  '/crm/schedule': 'schedule', '/crm/patients': 'patients', '/crm/medical-card': 'medical-card',
  '/crm/finance': 'finance', '/crm/cashier': 'cashier', '/crm/clinic-settings': 'clinic-settings',
  '/crm/billing': 'billing', '/crm/patient-inbox': 'patient-inbox', '/crm/visits': 'visits',
  '/crm/dental-chart': 'dental-chart', '/crm/treatment-plans': 'treatment-plans', '/crm/pricelist': 'pricelist',
  '/crm/lab': 'lab', '/crm/inventory': 'inventory', '/crm/documents': 'documents', '/crm/staff': 'staff',
  '/crm/reminders': 'reminders', '/crm/promotions': 'promotions', '/crm/marketing': 'promotions',
  '/crm/icd10': 'icd10', '/crm/workflow': 'workflow', '/analytics': 'analytics', '/admin': 'admin',
  '/audit': 'audit', '/agent-activity': 'agent-activity', '/ai-approvals': 'ai-approvals', '/backup': 'backup',
  '/shop': 'shop', '/school': 'school', '/settings': 'settings', '/bi': 'bi', '/diagnostics': 'diagnostics',
  '/diagnostics/referrals': 'diagnostics-referrals', '/diagnostics/centers': 'diagnostics-centers',
  '/diagnostics/laboratories': 'diagnostics-labs', '/diagnostics/results': 'diagnostics-results',
  '/diagnostics/calendar': 'diagnostics-calendar', '/diagnostics/statistics': 'diagnostics-statistics',
  '/diagnostics/settings': 'diagnostics-settings', '/diagnostics/center-dashboard': 'diagnostics',
  '/diagnostics/lab-dashboard': 'diagnostics', '/diagnostics/registrations': 'admin',
}

export const CRM_NAV_PAGE_IDS = [
  'schedule','patients','medical-card','finance','cashier','clinic-settings','billing','visits','dental-chart',
  'treatment-plans','pricelist','lab','inventory','documents','staff','reminders','promotions','icd10','patient-inbox','workflow',
] as const

export function pageIdFromPath(pathname: string): string | null {
  const clean = pathname.split('?')[0].replace(/\/$/, '') || '/'
  if (PATH_PAGE_ID[clean]) return PATH_PAGE_ID[clean]
  if (clean.startsWith('/shop')) return 'shop'
  if (clean.startsWith('/school')) return 'school'
  if (clean.startsWith('/crm/')) return clean.slice('/crm/'.length).split('/')[0] || null
  return null
}

export function canAccessPage(allowedPages: string[] | null | undefined, pageId: string | null | undefined): boolean {
  if (!pageId) return true
  const pages = allowedPages || []
  if (!pages.length) return false
  if (pages.includes(pageId)) return true
  if ((pageId === 'finance' || pageId === 'cashier') && (pages.includes('finance') || pages.includes('cashier'))) return true
  return false
}

export function firstAllowedCrmPath(allowedPages: string[] | null | undefined): string {
  const pages = allowedPages || []
  for (const id of CRM_NAV_PAGE_IDS) {
    if (canAccessPage(pages, id)) {
      if (id === 'finance' || id === 'cashier') return '/crm/finance'
      return `/crm/${id}`
    }
  }
  return '/'
}
