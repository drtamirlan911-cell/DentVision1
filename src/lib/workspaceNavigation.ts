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

/**
 * Stable return route for the currently authenticated workspace.
 * The source is the selected IAM context; this helper never selects a
 * membership or organization on behalf of the user.
 */
export function getWorkspaceHomeTarget(source: WorkspaceHomeSource): WorkspaceHomeTarget | null {
  const roleKey = String(source.roleKey || source.role || '').trim().toLowerCase()
  const rawScope = String(source.scopeType || source.organizationType || '').trim().toUpperCase()

  if (/^dental_lab|^dental-/.test(roleKey) || ['dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'qc_specialist', 'lab_coordinator'].includes(roleKey)) {
    return { scopeType: 'DENTAL_LAB', path: '/dental-lab', label: 'Зуботехническая лаборатория' }
  }

  const scopeType = rawScope || (
    roleKey.startsWith('employer_') || roleKey === 'employer' ? 'EMPLOYER'
      : roleKey.startsWith('diagnostic_') || ['radiologist', 'radiology_technician'].includes(roleKey) ? 'DIAGNOSTIC_CENTER'
        : roleKey.startsWith('medical_lab_') || roleKey === 'lab_diagnostic' ? 'LABORATORY'
          : roleKey === 'supplier' || roleKey.startsWith('supplier_') ? 'SUPPLIER'
            : roleKey.startsWith('lecturer') ? 'LECTURER'
              : roleKey.startsWith('academy_') ? 'ACADEMY'
                : roleKey === 'owner' || roleKey === 'director' || roleKey === 'doctor' || roleKey === 'admin' || roleKey === 'assistant' || roleKey === 'reception' ? (source.hasClinic ? 'CLINIC' : '')
                  : ''
  )

  switch (scopeType) {
    case 'CLINIC':
      return { scopeType, path: '/crm/schedule', label: 'Рабочее место клиники' }
    case 'DIAGNOSTIC_CENTER':
      return { scopeType, path: '/diagnostics/workspace', label: 'Кабинет диагностического центра' }
    case 'LABORATORY':
      return { scopeType, path: '/diagnostics/workspace', label: 'Кабинет лаборатории' }
    case 'SUPPLIER':
    case 'SUPPLIER_COMPANY':
      return { scopeType: 'SUPPLIER', path: '/supplier', label: 'Кабинет поставщика' }
    case 'DENTAL_LAB':
      return { scopeType, path: '/dental-lab', label: 'Зуботехническая лаборатория' }
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

export function isPartnerWorkspaceType(scopeType?: string | null): boolean {
  const value = String(scopeType || '').trim().toUpperCase()
  return Boolean(value && value !== 'CLINIC')
}
