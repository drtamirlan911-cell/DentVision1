/**
 * Frontend mirror of AI platform service map — navigation actions + stage chips.
 * Keep in sync with dentvision-backend/src/modules/ai/lib/platformMap.ts
 */

export const AI_NAV_ACTIONS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OPEN_SCHEDULE: '/crm/schedule',
  OpenPatients: '/crm/patients',
  OPEN_PATIENTS: '/crm/patients',
  OpenPatient: '/crm/patients',
  OpenMedicalCard: '/crm/medical-card',
  OPEN_MEDICAL_CARD: '/crm/medical-card',
  OpenCashier: '/crm/finance',
  OpenFinance: '/crm/finance',
  OPEN_FINANCE: '/crm/finance',
  OpenLab: '/crm/lab',
  OPEN_LABORATORY: '/crm/lab',
  OpenInventory: '/crm/inventory',
  OPEN_INVENTORY: '/crm/inventory',
  OpenStaff: '/crm/staff',
  OpenVisits: '/crm/visits',
  OpenDocuments: '/crm/documents',
  OPEN_DOCUMENTS: '/crm/documents',
  OpenReminders: '/crm/reminders',
  OpenDentalChart: '/crm/dental-chart',
  OpenTreatmentPlans: '/crm/treatment-plans',
  OpenPriceList: '/crm/pricelist',
  OpenPromotions: '/crm/promotions',
  OpenICD10: '/crm/icd10',
  OpenClinicSettings: '/crm/clinic-settings',
  OpenBilling: '/crm/billing',
  OPEN_BILLING: '/crm/billing',
  OPEN_INVOICE: '/crm/finance',
  OpenInvoice: '/crm/finance',
  OpenShop: '/shop',
  OPEN_SHOP: '/shop',
  OpenSchool: '/school',
  OPEN_SCHOOL: '/school',
  OpenSchoolWorkspace: '/school-workspace',
  OpenSupplier: '/supplier',
  OpenAnalytics: '/analytics',
  OPEN_ANALYTICS: '/analytics',
  OpenCRM: '/crm',
  OPEN_CRM: '/crm',
  OpenProfile: '/profile',
  OpenSettings: '/settings',
  OpenMyClinics: '/my-clinics',
  OpenDemo: '/crm/schedule?demo=1',
  OpenPricing: '/pricing',
  OpenJobs: '/jobs',
  OpenCommunity: '/community',
  OpenAdmin: '/admin',
  OpenAudit: '/audit',
  OpenBackup: '/backup',
  NAVIGATE: '',
}

export function stageFromPath(pathname?: string | null): string {
  const p = String(pathname || '').toLowerCase()
  if (!p || p === '/' || p.startsWith('/ai') || p.includes('intelligence')) return 'workspace'
  if (p.includes('/crm/patients')) return 'patients'
  if (p.includes('/crm/schedule')) return 'schedule'
  if (p.includes('/crm/finance') || p.includes('/crm/billing')) return 'finance'
  if (p.includes('/crm/inventory')) return 'inventory'
  if (p.includes('/crm/lab')) return 'lab'
  if (p.includes('/crm/dental-chart')) return 'dental-chart'
  if (p.includes('/crm/treatment-plans')) return 'treatment-plans'
  if (p.includes('/crm/visits') || p.includes('/crm/medical-card')) return 'clinical'
  if (p.includes('/crm/documents')) return 'documents'
  if (p.includes('/shop')) return 'shop'
  if (p.includes('/school-workspace')) return 'school'
  if (p.includes('/school')) return 'school'
  if (p.includes('/supplier')) return 'supplier'
  if (p.includes('/jobs')) return 'jobs'
  if (p.includes('/community')) return 'community'
  if (p.includes('/analytics')) return 'analytics'
  if (p.includes('/admin')) return 'admin'
  return 'workspace'
}

export function getSmartSuggestions(opts: {
  user?: { role?: string } | null
  guest?: boolean
  pathname?: string | null
  focusType?: string | null
}): string[] {
  const { user, guest, pathname, focusType } = opts
  if (guest || !user) {
    return ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Карта сервисов', 'Что в Academy OS?']
  }
  const stage = focusType === 'patient' ? 'patients' : stageFromPath(pathname)
  const role = String(user.role || '').toLowerCase()

  if (stage === 'patients' || stage === 'clinical') {
    return ['История лечения', 'План лечения', 'Зубная карта', 'Записать на приём']
  }

  const byStage: Record<string, string[]> = {
    schedule: ['Кто сегодня?', 'Записать пациента', 'Что важно сегодня?'],
    finance: ['Проверить долги', 'Показать выручку', 'Открыть кассу'],
    inventory: ['Что на складе', 'Открыть маркетплейс'],
    lab: ['Статусы лаборатории'],
    'dental-chart': ['Создать план лечения', 'Показать расписание'],
    'treatment-plans': ['Открытые планы', 'Записать пациента'],
    shop: ['Подобрать расходники', 'Что на складе'],
    school: ['Курсы для меня', 'Открыть кабинет лектора'],
    supplier: ['Кабинет продавца', 'Мои товары'],
    analytics: ['Показать выручку', 'План загрузки клиники'],
    jobs: ['Найди вакансии ортодонта', 'Разместить вакансию'],
    community: ['Открыть сообщество'],
    admin: ['Открыть платформу', 'Открыть аудит'],
  }

  const roleChips =
    role === 'doctor' || role === 'assistant'
      ? ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения']
      : role === 'owner' || role === 'director' || role === 'manager' || role === 'руководитель'
        ? ['Что важно сегодня?', 'Показать выручку', 'Проверить долги', 'Карта сервисов']
        : role === 'admin' || role === 'администратор' || role === 'reception'
          ? ['Показать расписание', 'Записать пациента', 'Открыть кассу']
          : role === 'buyer'
            ? ['Что на складе', 'Открыть маркетплейс']
            : role === 'supplier'
              ? ['Кабинет продавца', 'Открыть маркетплейс']
              : role === 'lecturer'
                ? ['Кабинет лектора', 'Открыть Academy OS']
                : ['Что важно сегодня?', 'Показать расписание', 'Карта сервисов']

  return [...new Set([...(byStage[stage] || []), ...roleChips])].slice(0, 4)
}
