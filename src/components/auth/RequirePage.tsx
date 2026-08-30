import React from 'react'
import { Skeleton } from '@/components/ui/ds';
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'
import { useIam } from '@/iam'
import { firstAllowedCrmPath, pageIdFromPath } from '@/lib/roleAccess'

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
  const { isAuthenticated, loading } = useAuth()
  const { isGuest } = useGuestStore()
  const iam = useIam()

  if (isGuest) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wait for auth hydration before evaluating pages — during context
  // switches restoreSession() runs asynchronously and pages may be empty.
  if (loading) {
    return (
      <div className="dv-page py-6 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton variant="text" lines={4} />
      </div>
    )
  }

  const pageId = page || pageIdFromPath(location.pathname)
  const allowed = iam.pages

  if (iam.canAccessPage(pageId)) {
    return <>{children}</>
  }

  return <Navigate to={firstAllowedCrmPath(allowed)} replace />
}

export default RequirePage
