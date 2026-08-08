import { useMemo } from 'react'
import { useAuth } from '@/store/auth.store'
import { createIamResolver, type IamResolver, type IamRoleInfo } from './resolver'

/**
 * React hook exposing the IAM resolver for the active auth context.
 *
 * Step 1 adapter: reads the legacy role/roleInfo from `useAuth` so behavior is
 * identical to today. In Step 3 the resolver will prefer backend permissions.
 */
export function useIam(): IamResolver {
  const { role, roleInfo } = useAuth()

  return useMemo(
    () => createIamResolver({ role, roleInfo: roleInfo as unknown as IamRoleInfo }),
    [role, roleInfo],
  )
}
