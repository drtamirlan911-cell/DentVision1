/**
 * Role-based CRM / platform page access helpers.
 * Source of truth for which pages a role may open: ORG_ROLES / PLATFORM_ROLES in auth.store.
 */

/** Map URL path → ORG_ROLES.pages id */
export const PATH_PAGE_ID: Record<string, string> = {
  '/crm/schedule': 'schedule',
  '/crm/patients': 'patients',
  '/crm/medical-card': 'medical-card',
  '/crm/finance': 'finance',
  '/crm/cashier': 'cashier',
  '/crm/clinic-settings': 'clinic-settings',
  '/crm/billing': 'billing',
  '/crm/visits': 'visits',
  '/crm/dental-chart': 'dental-chart',
  '/crm/treatment-plans': 'treatment-plans',
  '/crm/pricelist': 'pricelist',
  '/crm/lab': 'lab',
  '/crm/inventory': 'inventory',
  '/crm/documents': 'documents',
  '/crm/staff': 'staff',
  '/crm/reminders': 'reminders',
  '/crm/promotions': 'promotions',
  '/crm/icd10': 'icd10',
  '/analytics': 'analytics',
  '/admin': 'admin',
  '/audit': 'audit',
  '/backup': 'backup',
  '/shop': 'shop',
  '/school': 'school',
  '/ai': 'ai',
  '/settings': 'settings',
}

/** CRM sidebar order (ids must match ORG_ROLES.pages). */
export const CRM_NAV_PAGE_IDS = [
  'schedule',
  'patients',
  'medical-card',
  'finance',
  'clinic-settings',
  'billing',
  'visits',
  'dental-chart',
  'treatment-plans',
  'pricelist',
  'lab',
  'inventory',
  'documents',
  'staff',
  'reminders',
  'promotions',
  'icd10',
] as const

export function pageIdFromPath(pathname: string): string | null {
  const clean = pathname.split('?')[0].replace(/\/$/, '') || '/'
  if (PATH_PAGE_ID[clean]) return PATH_PAGE_ID[clean]
  // Prefix match for nested shop/school routes
  if (clean.startsWith('/shop')) return 'shop'
  if (clean.startsWith('/school')) return 'school'
  if (clean.startsWith('/crm/')) {
    const seg = clean.slice('/crm/'.length).split('/')[0]
    return seg || null
  }
  return null
}

export function canAccessPage(
  allowedPages: string[] | null | undefined,
  pageId: string | null | undefined,
): boolean {
  if (!pageId) return true
  const pages = allowedPages || []
  if (pages.length === 0) return false
  if (pages.includes(pageId)) return true
  // finance ↔ cashier alias (same CRM Касса surface)
  if (pageId === 'finance' && pages.includes('cashier')) return true
  if (pageId === 'cashier' && pages.includes('finance')) return true
  return false
}

/** First CRM path the role may open (fallback schedule → patients → /). */
export function firstAllowedCrmPath(allowedPages: string[] | null | undefined): string {
  const pages = allowedPages || []
  const order = [
    'schedule',
    'patients',
    'visits',
    'documents',
    'lab',
    'medical-card',
    'reminders',
  ]
  for (const id of order) {
    if (canAccessPage(pages, id)) return `/crm/${id === 'medical-card' ? 'medical-card' : id}`
  }
  for (const id of CRM_NAV_PAGE_IDS) {
    if (canAccessPage(pages, id)) {
      if (id === 'finance') return '/crm/finance'
      if (id === 'clinic-settings') return '/crm/clinic-settings'
      return `/crm/${id}`
    }
  }
  return '/'
}
