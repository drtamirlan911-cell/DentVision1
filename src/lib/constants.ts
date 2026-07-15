export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  BOOKING: '/book',
  SIGN: '/sign',

  // Core
  DASHBOARD: '/dashboard',
  AI: '/ai',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  ADMIN: '/admin',
  AUDIT: '/audit',
  BACKUP: '/backup',

  // CRM sub-app
  CRM: '/crm',
  SCHEDULE: '/crm/schedule',
  PATIENTS: '/crm/patients',
  MEDICAL_CARD: '/crm/medical-card',
  VISITS: '/crm/visits',
  ICD10: '/crm/icd10',
  DOCUMENTS: '/crm/documents',
  CASHIER: '/crm/cashier',
  PRICELIST: '/crm/pricelist',
  LAB: '/crm/lab',
  INVENTORY: '/crm/inventory',
  PROMOTIONS: '/crm/promotions',
  STAFF: '/crm/staff',

  // Shop sub-app
  SHOP: '/shop',
  SHOP_PRODUCT: '/shop',

  // School sub-app
  SCHOOL: '/school',
  SCHOOL_COURSE: '/school',
} as const

export type RouteKey = keyof typeof ROUTES

export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
]

export const isPublicRoute = (path: string): boolean =>
  PUBLIC_ROUTES.some((r) => path.startsWith(r)) ||
  path.startsWith(ROUTES.BOOKING) ||
  path.startsWith(ROUTES.SIGN)
