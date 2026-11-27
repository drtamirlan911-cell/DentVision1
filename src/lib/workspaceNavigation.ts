import { resolveLaboratoryWorkspaceKind } from './laboratoryWorkspace'
import { resolveDentalLabRoleCapabilities } from './dentalLabWorkspaceRole'

export interface WorkspaceHomeSource {
  scopeType?: string | null
  organizationType?: string | null
  roleKey?: string | null
  role?: string | null
  hasClinic?: boolean
}

export interface WorkspaceHomeTarget {
  scopeType: string
  path: string
  label: string
}

export interface WorkspaceNavigationItem {
  id: string
  label: string
  path: string
  page: string
}

export interface WorkspaceNavigationGroup {
  id: string
  label: string
  items: WorkspaceNavigationItem[]
}

const group = (id: string, label: string, items: WorkspaceNavigationItem[]): WorkspaceNavigationGroup => ({
  id,
  label,
  items,
})

const item = (id: string, label: string, path: string, page: string): WorkspaceNavigationItem => ({
  id,
  label,
  path,
  page,
})

const roleTokens = (role: string) => role
  .split(/[\s,]+/)
  .map((token) => token.trim().toLowerCase())
  .filter(Boolean)

/**
 * Stable return route for the currently authenticated workspace.
 * The source is the selected IAM context; this helper never selects a
 * membership or organization on behalf of the user.
 */
export function getWorkspaceHomeTarget(source: WorkspaceHomeSource): WorkspaceHomeTarget | null {
  const roleKey = String(source.roleKey || source.role || '').trim().toLowerCase()
  const tokens = roleTokens(roleKey)
  const rawScope = String(source.scopeType || source.organizationType || '').trim().toUpperCase()

  const isDentalLabRole = tokens.some((token) =>
    token.startsWith('dental_lab_')
    || ['dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'qc_specialist', 'lab_coordinator'].includes(token),
  )
  const isMedicalLabRole = tokens.some((token) => token.startsWith('medical_lab_'))
  const resolvedLabKind = rawScope === 'LABORATORY'
    ? resolveLaboratoryWorkspaceKind({ roleKey, organizationType: 'LABORATORY' })
    : null

  if (
    rawScope === 'MEDICAL_LAB'
    || rawScope === 'MEDICAL_LABORATORY'
    || resolvedLabKind === 'medical'
    || (rawScope !== 'LABORATORY' && isMedicalLabRole)
  ) {
    const financeOnlyRole = tokens.some((token) => token.includes('finance') || token === 'accountant')
      && !tokens.some((token) => /(?:^|_)(owner|admin|manager|director|reception|technician|validator|doctor|quality)$/.test(token))
    return {
      scopeType: 'LABORATORY',
      path: financeOnlyRole ? '/diagnostics/lab?workspace=medical-lab&tab=finance' : '/diagnostics/lab?workspace=medical-lab',
      label: 'Кабинет медицинской лаборатории',
    }
  }
  if (
    rawScope === 'DENTAL_LAB'
    || rawScope === 'DENTAL_LABORATORY'
    || resolvedLabKind === 'dental'
    || (rawScope !== 'LABORATORY' && isDentalLabRole)
  ) {
    const workPath = tokens.some((token) => token.includes('finance') || token === 'accountant')
      ? '/diagnostics/lab?workspace=dental-lab&tab=finance'
      : tokens.some((token) => token === 'qc_specialist' || token.endsWith('_quality'))
        ? '/diagnostics/lab?workspace=dental-lab&tab=quality'
        : tokens.some((token) => ['courier', 'logistics', 'delivery_operator', 'dispatcher'].includes(token))
          ? '/diagnostics/lab?workspace=dental-lab&tab=shipping'
          : tokens.some((token) => ['technician', 'dental_technician', 'lab_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'lab_coordinator'].includes(token))
            ? '/diagnostics/lab?workspace=dental-lab&tab=priority'
            : '/diagnostics/lab?workspace=dental-lab'
    return { scopeType: 'DENTAL_LAB', path: workPath, label: 'Кабинет зуботехнической лаборатории' }
  }

  const scopeType = rawScope || (
    tokens.some((token) => token.startsWith('employer_') || token === 'employer') ? 'EMPLOYER'
      : tokens.some((token) => token.startsWith('diagnostic_') || ['radiologist', 'radiology_technician'].includes(token)) ? 'DIAGNOSTIC_CENTER'
        : tokens.some((token) => token === 'supplier' || token.startsWith('supplier_')) ? 'SUPPLIER'
          : tokens.some((token) => token.startsWith('lecturer')) ? 'LECTURER'
            : tokens.some((token) => token.startsWith('academy_')) ? 'ACADEMY'
              : tokens.some((token) => ['owner', 'director', 'doctor', 'admin', 'assistant', 'reception'].includes(token)) ? (source.hasClinic ? 'CLINIC' : '')
                : ''
  )

  switch (scopeType) {
    case 'CLINIC':
      return { scopeType, path: '/crm/schedule', label: 'Рабочее место клиники' }
    case 'DIAGNOSTIC_CENTER': {
      const financeOnlyRole = tokens.some((token) => token.includes('finance') || token === 'accountant')
        && !tokens.some((token) => /(?:^|_)(owner|admin|manager|director|reception|operator|radiologist|technician|quality)$/.test(token))
      const qualityRole = tokens.some((token) => token.includes('quality') || token.includes('radiologist'))
      return {
        scopeType,
        path: financeOnlyRole
          ? '/diagnostics/center?tab=finance'
          : qualityRole
            ? '/diagnostics/results'
            : '/diagnostics/center?tab=worklist',
        label: 'Кабинет диагностического центра',
      }
    }
    case 'LABORATORY': {
      const kind = resolveLaboratoryWorkspaceKind({ roleKey, organizationType: 'LABORATORY' })
      return kind === 'medical'
        ? { scopeType, path: '/diagnostics/lab?workspace=medical-lab', label: 'Кабинет медицинской лаборатории' }
        : { scopeType, path: '/diagnostics/lab?workspace=dental-lab', label: 'Кабинет зуботехнической лаборатории' }
    }
    case 'SUPPLIER':
    case 'SUPPLIER_COMPANY':
      return { scopeType: 'SUPPLIER', path: '/supplier', label: 'Кабинет поставщика' }
    case 'LECTURER':
      return { scopeType, path: '/school/workspace', label: 'Кабинет преподавателя' }
    case 'ACADEMY':
      return { scopeType, path: '/academy/workspace', label: 'Кабинет академии' }
    case 'EMPLOYER':
      return { scopeType, path: '/employer', label: 'Кабинет работодателя' }
    case 'PARTNER':
      return { scopeType, path: '/shop', label: 'Кабинет партнёра' }
    default:
      return null
  }
}

/**
 * Operational navigation for each first-class organization workspace.
 * Every destination is an existing route or an already-supported URL-backed
 * tab in the owning workspace. The sidebar still applies IAM page visibility.
 */
export function getWorkspaceNavigationGroups(scopeType?: string | null, roleKey?: string | null): WorkspaceNavigationGroup[] {
  const scope = String(scopeType || '').trim().toUpperCase()
  const role = String(roleKey || '').trim().toLowerCase()
  const tokens = roleTokens(role)

  if (scope === 'CLINIC') {
    // Role keys arrive in both canonical and legacy dotted forms
    // (for example, clinic.doctor and doctor). Normalize only for menu
    // grouping; IAM page checks below remain the authorization boundary.
    const roles = new Set(tokens.map((token) => token.split('.').pop() || token))
    const has = (...keys: string[]) => keys.some((key) => roles.has(key))
    const management = has('owner', 'director', 'admin', 'manager')
    const doctor = has('doctor')
    const assistant = has('assistant', 'reception')
    const laboratory = has('lab')
    const finance = has('cashier', 'accountant', 'finance')
    const financeOnly = finance && !management && !doctor && !assistant && !laboratory
    const groups: WorkspaceNavigationGroup[] = []

    if (!financeOnly) {
      groups.push(group('clinic-day', 'Рабочий день', [
        item('schedule', 'Расписание приёма', '/crm/schedule', 'schedule'),
        item('patients', 'Пациенты', '/crm/patients', 'patients'),
        item('visits', 'Приёмы и посещения', '/crm/visits', 'visits'),
      ]))
    }

    if (doctor || management) {
      groups.push(group('clinic-care', 'Клиническая работа', [
        item('medical-card', 'Медицинские карты', '/crm/medical-card', 'medical-card'),
        item('dental-chart', 'Зубная карта', '/crm/dental-chart', 'dental-chart'),
        item('treatment-plans', 'Планы лечения', '/crm/treatment-plans', 'treatment-plans'),
        item('documents', 'Медицинские документы', '/crm/documents', 'documents'),
        item('icd10', 'МКБ-10', '/crm/icd10', 'icd10'),
      ]))
    }

    if (laboratory || management) {
      groups.push(group('clinic-lab', 'Лабораторная работа', [
        item('lab', 'Заказы лаборатории', '/crm/lab', 'lab'),
      ]))
    }

    if (management) {
      groups.push(group('clinic-management', 'Управление клиникой', [
        item('staff', 'Сотрудники', '/crm/staff', 'staff'),
        item('inventory', 'Склад и материалы', '/crm/inventory', 'inventory'),
        item('pricelist', 'Прайс и услуги', '/crm/pricelist', 'pricelist'),
        item('clinic-settings', 'Настройки клиники', '/crm/clinic-settings', 'clinic-settings'),
        item('analytics', 'Аналитика клиники', '/analytics', 'analytics'),
      ]))
    }

    if (finance || management) {
      groups.push(group('clinic-finance', 'Финансы', [
        item('cashier', 'Касса и оплаты', '/crm/cashier', 'cashier'),
        item('billing', 'Тариф и оплата DentVision', '/crm/billing', 'billing'),
      ]))
    }

    return groups
  }

  if (scope === 'DIAGNOSTIC_CENTER') {
    const managementRoles = tokens.some((token) =>
      ['owner', 'admin', 'manager', 'director', 'diagnostic_owner', 'diagnostic_admin', 'diagnostic_manager'].includes(token),
    )
    const financeRoles = tokens.some((token) =>
      token.includes('finance') || token === 'cashier' || token === 'accountant' || token.endsWith('_reception') || token === 'reception',
    )
    const cashierRoles = tokens.some((token) =>
      ['owner', 'admin', 'diagnostic_owner', 'diagnostic_admin'].includes(token),
    )
    const operationalRoles = tokens.some((token) =>
      token.includes('radiologist')
      || token.includes('radiology_technician')
      || token.includes('operator')
      || token.includes('reception')
      || token.includes('quality'),
    )
    const financeOnly = financeRoles && !managementRoles && !operationalRoles
    const groups: WorkspaceNavigationGroup[] = []
    if (!financeOnly) {
      groups.push(group('diagnostic-work', 'Работа с исследованиями', [
        item('queue', 'Рабочая очередь', '/diagnostics/center?tab=worklist', 'diagnostics'),
        item('referrals', 'Направления', '/diagnostics/referrals', 'diagnostics-referrals'),
        item('results', 'Результаты', '/diagnostics/results', 'diagnostics-results'),
      ]))
    }
    if (managementRoles) {
      groups.push(group('diagnostic-management', 'Организация центра', [
        item('calendar', 'Расписание', '/diagnostics/calendar', 'diagnostics-calendar'),
        item('analytics', 'Аналитика', '/diagnostics/statistics', 'diagnostics-statistics'),
        item('settings', 'Настройки центра', '/diagnostics/settings', 'diagnostics-settings'),
      ]))
    }
    if (financeRoles || managementRoles) {
      groups.push(group('diagnostic-finance', 'Финансы и расчёты', [
        item('finance', 'Расчёты и выплаты', '/diagnostics/center?tab=finance', 'diagnostics'),
        ...(cashierRoles ? [item('cashier', 'Касса', '/diagnostics/center?tab=cashier', 'diagnostics')] : []),
      ]))
    }
    return groups
  }

  if (scope === 'LABORATORY' || scope === 'MEDICAL_LAB' || scope === 'MEDICAL_LABORATORY' || scope === 'DENTAL_LAB' || scope === 'DENTAL_LABORATORY') {
    const kind = scope === 'DENTAL_LAB' || scope === 'DENTAL_LABORATORY'
      ? 'dental'
      : scope === 'MEDICAL_LAB' || scope === 'MEDICAL_LABORATORY'
        ? 'medical'
        : resolveLaboratoryWorkspaceKind({ roleKey: role, organizationType: 'LABORATORY' })

    if (kind === 'medical') {
      const canReadFinance = tokens.some((token) =>
        token.includes('finance')
        || token === 'accountant'
        || token === 'reception'
        || /(?:^|_)(owner|admin|manager|director)$/.test(token),
      )
      const financeOnly = tokens.some((token) => token.includes('finance') || token === 'accountant')
        && !tokens.some((token) => /(?:^|_)(owner|admin|manager|director|reception|technician|validator|doctor|quality)$/.test(token))
      const groups: WorkspaceNavigationGroup[] = []
      if (!financeOnly) {
        groups.push(group('medical-lab-work', 'Работа с анализами', [
          item('orders', 'Заказы и образцы', '/diagnostics/lab?workspace=medical-lab', 'diagnostics'),
        ]))
      }
      if (canReadFinance) {
        groups.push(group('medical-lab-finance', 'Финансы', [
          item('finance', 'Расчёты и выплаты', '/diagnostics/lab?workspace=medical-lab&tab=finance', 'diagnostics'),
        ]))
      }
      return groups
    }

    if (kind === 'dental') {
      const access = resolveDentalLabRoleCapabilities(role)
      const groups: WorkspaceNavigationGroup[] = []
      if (access.canReadProduction) {
        groups.push(group('dental-lab-work', 'Производство', [
          item('priority', 'Мои приоритетные задачи', '/diagnostics/lab?workspace=dental-lab&tab=priority', 'diagnostics'),
          item('materials', 'Материалы', '/diagnostics/lab?workspace=dental-lab&tab=materials', 'diagnostics'),
        ]))
      }
      if (access.canPerformQc) {
        groups.push(group('dental-lab-quality', 'Контроль качества', [
          item('quality', 'Очередь QC', '/diagnostics/lab?workspace=dental-lab&tab=quality', 'diagnostics'),
        ]))
      }
      if (access.canManageQc) {
        groups.push(group('dental-lab-management', 'Управление лабораторией', [
          item('team', 'Команда и назначения', '/diagnostics/lab?workspace=dental-lab&tab=team', 'diagnostics'),
          item('services', 'Услуги и цены', '/diagnostics/lab?workspace=dental-lab&tab=services', 'diagnostics'),
        ]))
      }
      if (access.canManageShipping) {
        groups.push(group('dental-lab-shipping', 'Выдача и доставка', [
          item('shipping', 'Отправка и выдача', '/diagnostics/lab?workspace=dental-lab&tab=shipping', 'diagnostics'),
        ]))
      }
      if (access.canManageFinance) {
        groups.push(group('dental-lab-finance', 'Финансы', [
          item('finance', 'Счета и выплаты', '/diagnostics/lab?workspace=dental-lab&tab=finance', 'diagnostics'),
        ]))
      }
      return groups
    }

    return [
      group('laboratory-work', 'Работа лаборатории', [
        item('today', 'Сегодня', '/diagnostics/lab', 'diagnostics'),
        item('queue', 'Рабочая очередь', '/diagnostics/workspace', 'diagnostics'),
        item('referrals', 'Заказы и направления', '/diagnostics/referrals', 'diagnostics-referrals'),
        item('results', 'Результаты', '/diagnostics/results', 'diagnostics-results'),
      ]),
    ]
  }

  if (scope === 'SUPPLIER' || scope === 'SUPPLIER_COMPANY') {
    return [
      group('supplier-operations', 'Работа с заказами', [
        item('sales', 'Заказы клиник', '/supplier?tab=sales', 'supplier'),
        item('stock', 'Остатки на складах', '/supplier?tab=stock', 'supplier'),
        item('catalog', 'Каталог товаров', '/supplier?tab=catalog', 'supplier'),
        item('returns', 'Возвраты и претензии', '/supplier?tab=returns', 'supplier'),
      ]),
      group('supplier-growth', 'Развитие компании', [
        item('ads', 'Продвижение', '/supplier?tab=ads', 'supplier'),
        item('analytics', 'Аналитика спроса', '/supplier?tab=analytics', 'supplier'),
        item('profile', 'Профиль компании', '/supplier?tab=profile', 'supplier'),
      ]),
    ]
  }

  if (scope === 'LECTURER') {
    return [
      group('lecturer-work', 'Преподавание', [
        item('courses', 'Мои курсы и продукты', '/school/workspace?tab=courses', 'school'),
        item('analytics', 'Результаты и аналитика', '/school/workspace?tab=analytics', 'school'),
        item('profile', 'Профиль преподавателя', '/school/workspace?tab=profile', 'school'),
      ]),
    ]
  }

  if (scope === 'ACADEMY') {
    return [
      group('academy-learning', 'Обучение', [
        item('courses', 'Курсы', '/academy/workspace?tab=courses', 'school'),
        item('students', 'Учащиеся', '/academy/workspace?tab=students', 'school'),
      ]),
      group('academy-management', 'Команда', [
        item('team', 'Сотрудники академии', '/academy/workspace?section=team', 'school'),
      ]),
    ]
  }

  if (scope === 'EMPLOYER') {
    return [
      group('employer-work', 'Подбор специалистов', [
        item('vacancies', 'Вакансии и отклики', '/employer', 'employer'),
        item('jobs-market', 'Рынок специалистов', '/jobs', 'jobs'),
      ]),
    ]
  }

  if (scope === 'PARTNER') {
    return [
      group('partner-work', 'Партнёрская деятельность', [
        item('shop', 'Маркетплейс', '/shop', 'shop'),
      ]),
    ]
  }

  return []
}

/** Match route and query-backed tabs without treating every query value as a different route. */
export function isWorkspaceNavigationActive(
  pathname: string,
  search: string,
  target: string,
  options: { matchAllTabs?: boolean } = {},
): boolean {
  const [targetPath, targetQuery = ''] = target.split('?')
  const pathMatches = targetPath === '/'
    ? pathname === '/'
    : pathname === targetPath || pathname.startsWith(`${targetPath}/`)
  if (!pathMatches) return false

  const actualParams = new URLSearchParams(search)
  const expectedParams = new URLSearchParams(targetQuery)
  const targetSelectsTab = expectedParams.has('tab') || expectedParams.has('section')
  const actualSelectsTab = actualParams.has('tab') || actualParams.has('section')
  // A base menu item (e.g. "Today") must not remain highlighted when another
  // query-backed tab is open on the same route. The pinned cabinet shortcut
  // opts into matchAllTabs because it represents the whole workspace.
  if (!options.matchAllTabs && actualSelectsTab && !targetSelectsTab) return false

  for (const [key, value] of expectedParams.entries()) {
    if (actualParams.get(key) !== value) return false
  }
  return true
}

/** Resolve a query-backed workspace tab without opening sections the active role cannot access. */
export function resolveWorkspaceTab(
  requestedTab: string | null | undefined,
  availableTabs: readonly string[],
  fallbackTab: string,
): string {
  return requestedTab && availableTabs.includes(requestedTab) ? requestedTab : fallbackTab
}

export function isPartnerWorkspaceType(scopeType?: string | null): boolean {
  const value = String(scopeType || '').trim().toUpperCase()
  return Boolean(value && value !== 'CLINIC')
}
