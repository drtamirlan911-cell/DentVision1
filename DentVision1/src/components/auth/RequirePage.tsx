import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'
import { canAccessPage, firstAllowedCrmPath, pageIdFromPath } from '@/lib/roleAccess'

/**
 * Blocks deep-links to CRM/platform pages outside the active role's pages list.
 * Guests are left to IntelligenceLayout (demo modal).
 */
export function RequirePage({
  page,
  children,
}: {
  /** Explicit page id; if omitted, derived from current path. */
  page?: string
  children: React.ReactNode
}) {
  const location = useLocation()
  const { roleInfo, isAuthenticated } = useAuth()
  const { isGuest } = useGuestStore()

  if (isGuest || !isAuthenticated) {
    return <>{children}</>
  }

  const pageId = page || pageIdFromPath(location.pathname)
  const allowed = roleInfo?.pages || []

  if (canAccessPage(allowed, pageId)) {
    return <>{children}</>
  }

  return <Navigate to={firstAllowedCrmPath(allowed)} replace />
}

export default RequirePage
