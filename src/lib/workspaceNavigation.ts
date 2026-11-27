import { resolveLaboratoryWorkspaceKind } from './laboratoryWorkspace'

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

  if (rawScope === 'DENTAL_LAB' || rawScope === 'DENTAL_LABORATORY' || isDentalLabRole) {
    return { scopeType: 'DENTAL_LAB', path: '/diagnostics/lab?workspace=dental-lab', label: 'Кабинет зуботехнической лаборатории' }
  }
  if (rawScope === 'MEDICAL_LAB' || rawScope === 'MEDICAL_LABORATORY' || isMedicalLabRole) {
    return { scopeType: 'LABORATORY', path: '/diagnostics/lab?workspace=medical-lab', label: 'Кабинет медицинской лаборатории' }
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
    case 'DIAGNOSTIC_CENTER':
      return { scopeType, path: '/diagnostics/center', label: 'Кабинет диагностического центра' }
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

  if (scope === 'DIAGNOSTIC_CENTER') {
    return [
      group('diagnostic-work', 'Работа с исследованиями', [
        item('today', 'Сегодня', '/diagnostics/center', 'diagnostics'),
        item('queue', 'Рабочая очередь', '/diagnostics/workspace', 'diagnostics'),
        item('referrals', 'Направления', '/diagnostics/referrals', 'diagnostics-referrals'),
        item('results', 'Результаты', '/diagnostics/results', 'diagnostics-results'),
      ]),
      group('diagnostic-management', 'Организация центра', [
        item('calendar', 'Расписание', '/diagnostics/calendar', 'diagnostics-calendar'),
        item('analytics', 'Аналитика', '/diagnostics/statistics', 'diagnostics-statistics'),
        item('settings', 'Настройки центра', '/diagnostics/settings', 'diagnostics-settings'),
      ]),
    ]
  }

  if (scope === 'LABORATORY' || scope === 'MEDICAL_LAB' || scope === 'MEDICAL_LABORATORY' || scope === 'DENTAL_LAB' || scope === 'DENTAL_LABORATORY') {
    const kind = scope === 'DENTAL_LAB' || scope === 'DENTAL_LABORATORY'
      ? 'dental'
      : scope === 'MEDICAL_LAB' || scope === 'MEDICAL_LABORATORY'
        ? 'medical'
        : resolveLaboratoryWorkspaceKind({ roleKey: role, organizationType: 'LABORATORY' })

    if (kind === 'medical') {
      const groups = [
        group('medical-lab-work', 'Работа с анализами', [
          item('orders', 'Заказы и образцы', '/diagnostics/lab?workspace=medical-lab', 'diagnostics'),
        ]),
      ]
      if (tokens.some((token) => token.includes('finance') || /^(owner|admin|org_owner|org_admin)$/.test(token))) {
        groups.push(group('medical-lab-finance', 'Финансы', [
          item('finance', 'Расчёты и выплаты', '/diagnostics/lab?workspace=medical-lab&tab=finance', 'diagnostics'),
        ]))
      }
      return groups
    }

    if (kind === 'dental') {
      return [
        group('dental-lab-work', 'Производство', [
          item('production', 'Заказы и производство', '/diagnostics/lab?workspace=dental-lab', 'diagnostics'),
        ]),
      ]
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
        item('content', 'Учебные материалы', '/academy/workspace?section=content', 'school'),
        item('assessments', 'Оценивание и тесты', '/academy/workspace?section=assessments', 'school'),
        item('students', 'Учащиеся', '/academy/workspace?tab=students', 'school'),
        item('certificates', 'Сертификаты', '/academy/workspace?section=certificates', 'school'),
      ]),
      group('academy-management', 'Управление академией', [
        item('schedule', 'Расписание', '/academy/workspace?section=schedule', 'school'),
        item('finance', 'Финансы и выплаты', '/academy/workspace?section=finance', 'school'),
        item('analytics', 'Аналитика обучения', '/academy/workspace?section=analytics', 'school'),
        item('team', 'Команда', '/academy/workspace?section=team', 'school'),
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
export function isWorkspaceNavigationActive(pathname: string, search: string, target: string): boolean {
  const [targetPath, targetQuery = ''] = target.split('?')
  const pathMatches = targetPath === '/'
    ? pathname === '/'
    : pathname === targetPath || pathname.startsWith(`${targetPath}/`)
  if (!pathMatches) return false

  const actualParams = new URLSearchParams(search)
  const expectedParams = new URLSearchParams(targetQuery)
  for (const [key, value] of expectedParams.entries()) {
    if (actualParams.get(key) !== value) return false
  }
  return true
}

export function isPartnerWorkspaceType(scopeType?: string | null): boolean {
  const value = String(scopeType || '').trim().toUpperCase()
  return Boolean(value && value !== 'CLINIC')
}
