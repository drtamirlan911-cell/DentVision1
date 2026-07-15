export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  BOOKING: '/booking',
  SIGN: '/sign',

  // SuperApp
  APP: '/app',
  DASHBOARD: '/app/dashboard',
  CRM: '/app/crm',
  SCHEDULE: '/app/schedule',
  PATIENTS: '/app/patients',
  MEDICAL_CARD: '/app/medical-card',
  VISITS: '/app/visits',
  ICD10: '/app/icd10',
  DOCUMENTS: '/app/documents',
  CASHIER: '/app/cashier',
  PRICELIST: '/app/pricelist',
  LAB: '/app/lab',
  INVENTORY: '/app/inventory',
  PROMOTIONS: '/app/promotions',
  STAFF: '/app/staff',
  AUDIT: '/app/audit',
  BACKUP: '/app/backup',
  ADMIN: '/app/admin',
  AI: '/app/ai',
  SHOP: '/app/shop',
  SHOP_PRODUCT: '/app/shop',
  SCHOOL: '/app/school',
  SCHOOL_COURSE: '/app/school',
  ANALYTICS: '/app/analytics',
  SETTINGS: '/app/settings',
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
