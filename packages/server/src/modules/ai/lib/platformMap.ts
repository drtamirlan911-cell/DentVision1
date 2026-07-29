/**
 * Full DentVision service map — single source of truth for AI navigation,
 * role guidance, and stage-aware suggestions. Keep English keys for tools;
 * Russian labels for chat/UI.
 */

export type PlatformSection = {
  key: string
  label: string
  path: string
  /** Open* action type used by the frontend executor */
  openAction: string
  group: 'crm' | 'growth' | 'platform' | 'public'
  /** Roles that should hear about this section (empty = everyone authenticated) */
  roles?: string[]
  guestOk?: boolean
  aliases?: string[]
  blurb: string
}

export const PLATFORM_SECTIONS: PlatformSection[] = [
  // ── CRM ──
  { key: 'schedule', label: 'Расписание', path: '/crm/schedule', openAction: 'OpenSchedule', group: 'crm', blurb: 'Записи, кресла, лист ожидания', aliases: ['расписание', 'записи', 'календарь'] },
  { key: 'patients', label: 'Пациенты', path: '/crm/patients', openAction: 'OpenPatients', group: 'crm', blurb: 'База пациентов, поиск, карточки', aliases: ['пациенты', 'база'] },
  { key: 'medical-card', label: 'Медкарта', path: '/crm/medical-card', openAction: 'OpenMedicalCard', group: 'crm', blurb: 'Анамнез, аллергии, страховка', aliases: ['медкарта', 'медицинская карта'] },
  { key: 'visits', label: 'Визиты', path: '/crm/visits', openAction: 'OpenVisits', group: 'crm', blurb: 'Журнал приёмов и диагнозов', aliases: ['визиты', 'приёмы', 'приемы'] },
  { key: 'dental-chart', label: 'Зубная карта', path: '/crm/dental-chart', openAction: 'OpenDentalChart', group: 'crm', blurb: 'Одонтограмма FDI', aliases: ['зубная карта', 'одонтограмма'] },
  { key: 'treatment-plans', label: 'Планы лечения', path: '/crm/treatment-plans', openAction: 'OpenTreatmentPlans', group: 'crm', blurb: 'Этапы лечения и бюджет', aliases: ['планы лечения', 'план лечения'] },
  { key: 'finance', label: 'Касса', path: '/crm/finance', openAction: 'OpenFinance', group: 'crm', blurb: 'Счета, оплаты, должники', aliases: ['касса', 'финансы', 'оплаты'] },
  { key: 'lab', label: 'Лаборатория', path: '/crm/lab', openAction: 'OpenLab', group: 'crm', blurb: 'Заказы-наряды в лабораторию', aliases: ['лаборатория', 'лаб'] },
  { key: 'inventory', label: 'Склад', path: '/crm/inventory', openAction: 'OpenInventory', group: 'crm', blurb: 'Остатки клиники, дозаказ', aliases: ['склад', 'инвентарь', 'остатки'] },
  { key: 'documents', label: 'Документы', path: '/crm/documents', openAction: 'OpenDocuments', group: 'crm', blurb: 'Договоры, согласия, шаблоны', aliases: ['документы', 'договоры'] },
  { key: 'staff', label: 'Сотрудники', path: '/crm/staff', openAction: 'OpenStaff', group: 'crm', roles: ['OWNER', 'DIRECTOR', 'ADMIN', 'MANAGER'], blurb: 'Команда клиники и роли', aliases: ['сотрудники', 'персонал', 'штат'] },
  { key: 'reminders', label: 'Напоминания', path: '/crm/reminders', openAction: 'OpenReminders', group: 'crm', blurb: 'SMS/напоминания о визитах', aliases: ['напоминания'] },
  { key: 'pricelist', label: 'Прайс', path: '/crm/pricelist', openAction: 'OpenPriceList', group: 'crm', blurb: 'Прайс-лист услуг клиники', aliases: ['прайс', 'прайс-лист', 'услуги', 'цены услуг'] },
  { key: 'promotions', label: 'Акции', path: '/crm/promotions', openAction: 'OpenPromotions', group: 'crm', roles: ['OWNER', 'DIRECTOR', 'ADMIN', 'MANAGER'], blurb: 'Акции и скидки', aliases: ['акции', 'скидки', 'промо'] },
  { key: 'icd10', label: 'МКБ-10', path: '/crm/icd10', openAction: 'OpenICD10', group: 'crm', blurb: 'Справочник стоматологических кодов', aliases: ['мкб', 'мкб-10', 'icd10', 'диагнозы'] },
  { key: 'clinic-settings', label: 'Настройки клиники', path: '/crm/clinic-settings', openAction: 'OpenClinicSettings', group: 'crm', roles: ['OWNER', 'DIRECTOR', 'ADMIN'], blurb: 'Часовой пояс, валюта, Kaspi, бренд', aliases: ['настройки клиники'] },
  { key: 'billing', label: 'Тариф клиники', path: '/crm/billing', openAction: 'OpenBilling', group: 'crm', roles: ['OWNER', 'DIRECTOR', 'ADMIN'], blurb: 'Подписка SaaS и оплата тарифа', aliases: ['тариф клиники', 'биллинг', 'подписка'] },

  // ── Growth / ecosystem ──
  { key: 'shop', label: 'Маркетплейс', path: '/shop', openAction: 'OpenShop', group: 'growth', guestOk: true, blurb: 'Закупки у поставщиков, DentCash', aliases: ['магазин', 'маркетплейс', 'marketplace', 'закупки'] },
  { key: 'school', label: 'Academy OS', path: '/school', openAction: 'OpenSchool', group: 'growth', guestOk: true, blurb: 'Курсы, вебинары, учебники', aliases: ['академия', 'школа', 'academy', 'курсы', 'обучение'] },
  { key: 'analytics', label: 'Аналитика', path: '/analytics', openAction: 'OpenAnalytics', group: 'growth', roles: ['OWNER', 'DIRECTOR', 'ADMIN', 'MANAGER'], blurb: 'KPI клиники и загрузка', aliases: ['аналитика', 'отчёты', 'отчеты', 'kpi'] },
  { key: 'jobs', label: 'Вакансии', path: '/jobs', openAction: 'OpenJobs', group: 'growth', guestOk: true, blurb: 'Вакансии и резюме в стоматологии', aliases: ['вакансии', 'работа', 'резюме'] },
  { key: 'community', label: 'Сообщество', path: '/community', openAction: 'OpenCommunity', group: 'growth', guestOk: true, blurb: 'Лента и сообщения коллег', aliases: ['сообщество', 'лента', 'чат'] },
  { key: 'supplier', label: 'Кабинет продавца', path: '/supplier', openAction: 'OpenSupplier', group: 'growth', roles: ['SUPPLIER', 'OWNER', 'ADMIN', 'SUPERADMIN'], blurb: 'Товары и заказы поставщика', aliases: ['кабинет продавца', 'поставщик', 'seller'] },
  { key: 'school-workspace', label: 'Кабинет лектора', path: '/school-workspace', openAction: 'OpenSchoolWorkspace', group: 'growth', roles: ['LECTURER', 'OWNER', 'ADMIN', 'SUPERADMIN'], blurb: 'Курсы и вебинары лектора', aliases: ['кабинет лектора', 'лектор'] },

  // ── Platform / account ──
  { key: 'profile', label: 'Профиль', path: '/profile', openAction: 'OpenProfile', group: 'platform', guestOk: true, blurb: 'Личный профиль и фото', aliases: ['профиль'] },
  { key: 'settings', label: 'Настройки', path: '/settings', openAction: 'OpenSettings', group: 'platform', blurb: 'Личные настройки аккаунта', aliases: ['настройки'] },
  { key: 'my-clinics', label: 'Мои клиники', path: '/my-clinics', openAction: 'OpenMyClinics', group: 'platform', blurb: 'Переключение между клиниками', aliases: ['мои клиники', 'клиники'] },
  { key: 'admin', label: 'Платформа', path: '/admin', openAction: 'OpenAdmin', group: 'platform', roles: ['SUPERADMIN'], blurb: 'SuperAdmin: клиники и пользователи', aliases: ['админка', 'платформа', 'суперадмин'] },
  { key: 'audit', label: 'Аудит', path: '/audit', openAction: 'OpenAudit', group: 'platform', roles: ['OWNER', 'DIRECTOR', 'ADMIN', 'SUPERADMIN'], blurb: 'Журнал действий', aliases: ['аудит', 'логи'] },
  { key: 'backup', label: 'Бэкапы', path: '/backup', openAction: 'OpenBackup', group: 'platform', roles: ['OWNER', 'DIRECTOR', 'ADMIN', 'SUPERADMIN'], blurb: 'Резервные копии данных', aliases: ['бэкап', 'бэкапы', 'backup'] },

  // ── Public ──
  { key: 'demo', label: 'Демо-клиника', path: '/crm/schedule?demo=1', openAction: 'OpenDemo', group: 'public', guestOk: true, blurb: 'Попробовать CRM без регистрации', aliases: ['демо', 'демо-клиника', 'демо клиника'] },
  { key: 'pricing', label: 'Тарифы', path: '/pricing', openAction: 'OpenPricing', group: 'public', guestOk: true, blurb: 'Тарифы DentVision SaaS', aliases: ['тарифы', 'цены', 'pricing'] },
]

const byKey = new Map(PLATFORM_SECTIONS.map((s) => [s.key, s]))

export const NAV_PATHS: Record<string, string> = Object.fromEntries(
  PLATFORM_SECTIONS.map((s) => [s.key, s.path]),
)

export const NAV_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_SECTIONS.map((s) => [s.key, s.label]),
)

export const NAV_OPEN_ACTIONS: Record<string, string> = Object.fromEntries(
  PLATFORM_SECTIONS.map((s) => [s.openAction, s.path]),
)

/** Alias → canonical key */
export const NAV_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const s of PLATFORM_SECTIONS) {
    out[s.key] = s.key
    out[s.label.toLowerCase()] = s.key
    for (const a of s.aliases || []) out[a.toLowerCase()] = s.key
  }
  // Extra common aliases
  Object.assign(out, {
    касса: 'finance',
    финансы: 'finance',
    маркетплейс: 'shop',
    marketplace: 'shop',
    academy: 'school',
    'academy os': 'school',
    зубнаякарта: 'dental-chart',
    планылечения: 'treatment-plans',
  })
  return out
})()

export function normalizeRole(role?: string | null): string {
  return String(role || '').trim().toUpperCase()
}

export function sectionAllowedForRole(section: PlatformSection, role?: string | null, isGuest = false): boolean {
  if (isGuest || normalizeRole(role) === 'GUEST') return !!section.guestOk
  if (!section.roles || section.roles.length === 0) return true
  const r = normalizeRole(role)
  if (r === 'SUPERADMIN') return true
  // Director ≈ owner for product guidance
  if (r === 'DIRECTOR' && section.roles.includes('OWNER')) return true
  if (r === 'RECEPTION' && section.roles.includes('ADMIN')) return true
  return section.roles.includes(r)
}

export function sectionsForRole(role?: string | null, isGuest = false): PlatformSection[] {
  return PLATFORM_SECTIONS.filter((s) => sectionAllowedForRole(s, role, isGuest))
}

export function availableSectionKeys(role?: string | null, isGuest = false): string[] {
  return sectionsForRole(role, isGuest).map((s) => s.key)
}

export function availableSectionsRu(role?: string | null, isGuest = false): string {
  return sectionsForRole(role, isGuest)
    .map((s) => `• ${s.label} — ${s.blurb}`)
    .join('\n')
}

export function availableSectionsData(role?: string | null, isGuest = false) {
  return sectionsForRole(role, isGuest).map((s) => ({
    key: s.key,
    label: s.label,
    path: s.path,
    openAction: s.openAction,
  }))
}

export function normalizeNavSection(raw: unknown): string {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/^crm\//, '')
  if (!key) return ''
  if (byKey.has(key)) return key
  if (NAV_ALIASES[key]) return NAV_ALIASES[key]
  const last = key.split('/').filter(Boolean).pop() || ''
  if (byKey.has(last)) return last
  if (NAV_ALIASES[last]) return NAV_ALIASES[last]
  return key
}

export function resolveSection(raw: unknown): PlatformSection | null {
  const key = normalizeNavSection(raw)
  return byKey.get(key) || null
}

/** Compact map injected into the LLM system prompt (keeps tokens low). */
export function platformMapPromptBlock(role?: string | null, isGuest = false): string {
  const sections = sectionsForRole(role, isGuest)
  const byGroup: Record<string, PlatformSection[]> = {}
  for (const s of sections) {
    ;(byGroup[s.group] ||= []).push(s)
  }
  const groupTitle: Record<string, string> = {
    crm: 'CRM клиники',
    growth: 'Экосистема',
    platform: 'Аккаунт / платформа',
    public: 'Публичное',
  }
  const lines = ['КАРТА СЕРВИСОВ DENTVISION (открывай через navigate, пиши русские названия):']
  for (const [g, list] of Object.entries(byGroup)) {
    lines.push(`${groupTitle[g] || g}:`)
    for (const s of list) lines.push(`• ${s.label} → ${s.path} (${s.blurb})`)
  }
  lines.push('Свобода: можешь вести пользователя по любому доступному разделу, подсказывать следующий шаг и комбинировать CRM + маркет + академию.')
  return lines.join('\n')
}

/** Infer stage from UI pathname for stage-aware guidance. */
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
  if (p.includes('/crm/staff')) return 'staff'
  if (p.includes('/crm/reminders')) return 'reminders'
  if (p.includes('/crm/pricelist') || p.includes('/crm/promotions')) return 'marketing'
  if (p.includes('/shop')) return 'shop'
  if (p.includes('/school')) return 'school'
  if (p.includes('/supplier')) return 'supplier'
  if (p.includes('/jobs')) return 'jobs'
  if (p.includes('/community')) return 'community'
  if (p.includes('/analytics')) return 'analytics'
  if (p.includes('/profile') || p.includes('/settings')) return 'account'
  if (p.includes('/admin') || p.includes('/audit')) return 'admin'
  return 'workspace'
}

export function stageAwareSuggestions(opts: {
  role?: string | null
  isGuest?: boolean
  stage?: string | null
  focusType?: string | null
}): string[] {
  const { role, isGuest, stage, focusType } = opts
  if (isGuest || normalizeRole(role) === 'GUEST') {
    return ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Что в Academy OS?', 'Открыть маркетплейс']
  }
  if (focusType === 'patient' || stage === 'patients' || stage === 'clinical') {
    return ['История лечения', 'План лечения', 'Зубная карта', 'Записать на приём']
  }
  const r = normalizeRole(role)
  const byStage: Record<string, string[]> = {
    schedule: ['Кто сегодня?', 'Записать пациента', 'Лист ожидания', 'Что важно сегодня?'],
    finance: ['Проверить долги', 'Показать выручку', 'Открыть кассу'],
    inventory: ['Что на складе', 'Открыть маркетплейс', 'Что заканчивается'],
    lab: ['Статусы лаборатории', 'Просроченные заказы'],
    'dental-chart': ['Обновить зубную карту', 'Создать план лечения'],
    'treatment-plans': ['Открытые планы', 'Записать пациента'],
    shop: ['Подобрать расходники', 'Что на складе', 'Мои заказы'],
    school: ['Курсы для меня', 'Вебинары', 'Открыть кабинет лектора'],
    supplier: ['Мои товары', 'Заказы продавца'],
    analytics: ['Показать выручку', 'Загрузка врачей', 'План загрузки клиники'],
    jobs: ['Найди вакансии', 'Разместить вакансию'],
    community: ['Открыть ленту', 'Сообщения'],
    marketing: ['Активные акции', 'Открыть прайс'],
    account: ['Открыть профиль', 'Мои клиники'],
    admin: ['Список клиник', 'Открыть аудит'],
    workspace: [],
  }
  const stageChips = byStage[stage || 'workspace'] || []
  const roleChips =
    r === 'DOCTOR' || r === 'ASSISTANT'
      ? ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения']
      : r === 'OWNER' || r === 'DIRECTOR' || r === 'MANAGER'
        ? ['Что важно сегодня?', 'Показать выручку', 'Проверить долги', 'План загрузки клиники']
        : r === 'ADMIN' || r === 'RECEPTION'
          ? ['Показать расписание', 'Записать пациента', 'Открыть кассу']
          : r === 'BUYER'
            ? ['Что на складе', 'Открыть маркетплейс', 'Показать заказы']
            : r === 'SUPPLIER'
              ? ['Кабинет продавца', 'Мои товары', 'Открыть маркетплейс']
              : r === 'LECTURER'
                ? ['Кабинет лектора', 'Мои курсы', 'Открыть Academy OS']
                : r === 'SUPERADMIN'
                  ? ['Открыть платформу', 'Список клиник', 'Открыть аудит']
                  : ['Что важно сегодня?', 'Показать расписание', 'Проверить долги']

  return [...new Set([...stageChips, ...roleChips])].slice(0, 4)
}
