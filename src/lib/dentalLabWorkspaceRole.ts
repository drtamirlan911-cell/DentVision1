export interface DentalLabRoleCapabilities {
  canManageQc: boolean
  canManageShipping: boolean
  canManageFinance: boolean
  canReadProduction: boolean
  canConsumeMaterials: boolean
  canReadOrders: boolean
}

function roleTokens(value: unknown): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((role) => role.trim())
    .filter(Boolean)
}

/** Matches a canonical partner role and its legacy short role equivalent. */
export function hasDentalLabRole(role: unknown, ...expectedRoles: string[]): boolean {
  const roles = roleTokens(role)
  return roles.some((value) => expectedRoles.some((expected) =>
    value === expected || value.endsWith(`_${expected}`) || value.endsWith(`.${expected}`),
  ))
}

/**
 * Keep sidebar visibility and the dental-lab workspace tabs on the same
 * role contract. The backend remains authoritative for every action.
 */
export function resolveDentalLabRoleCapabilities(role: unknown): DentalLabRoleCapabilities {
  const canManageQc = hasDentalLabRole(role, 'owner', 'admin', 'manager', 'director', 'lab_manager')
  const canManageShipping = canManageQc || hasDentalLabRole(role, 'courier', 'logistics', 'delivery_operator', 'dispatcher')
  const canManageFinance = canManageQc || hasDentalLabRole(role, 'lab_finance', 'finance', 'accountant')
  const canReadProduction = canManageQc || hasDentalLabRole(
    role,
    'lab_coordinator',
    'coordinator',
    'qc_specialist',
    'technician',
    'dental_technician',
    'lab_technician',
    'cad_designer',
    'ceramist',
    'orthodontic_technician',
  )
  const canConsumeMaterials = canManageQc || hasDentalLabRole(
    role,
    'technician',
    'dental_technician',
    'lab_technician',
    'cad_designer',
    'ceramist',
    'orthodontic_technician',
  )

  return {
    canManageQc,
    canManageShipping,
    canManageFinance,
    canReadProduction,
    canConsumeMaterials,
    canReadOrders: canReadProduction || canManageShipping,
  }
}
