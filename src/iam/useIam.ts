import { useMemo } from 'react'
import { useAuth } from '@/store/auth.store'
import { createIamResolver, type IamResolver, type IamRoleInfo } from './resolver'

/**
 * React hook exposing the IAM resolver for the active auth context.
 *
 * Adapter over `useAuth`: reads the legacy role/roleInfo plus the server-side
 * effective permissions exposed by `/me` (Step 2). The resolver already prefers
 * server-provided permissions over the shared role matrix, so once a consumer
 * uses `useIam()` it automatically follows backend policy.
 *
 * Step 3: now also reads server-provided `pages` and `capabilities` for
 * page visibility and capability flags.
 */
export function useIam(): IamResolver {
  const { role, roleInfo, permissions, pages, capabilities, effectiveRole } = useAuth()

  return useMemo(
    () => createIamResolver({
      role: effectiveRole || role,
      roleInfo: roleInfo as unknown as IamRoleInfo,
      permissions,
      pages,
      capabilities,
    }),
    [role, effectiveRole, roleInfo, permissions, pages, capabilities],
  )
}
