import React from 'react'
import { Skeleton } from '@/components/ui/ds';
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'
import { useIam } from '@/iam'
import { firstAllowedCrmPath, pageIdFromPath } from '@/lib/roleAccess'
import Welcome from '@/pages/Welcome'

/**
 * Blocks deep-links to CRM/platform pages outside the active role's pages list.
 * The dashboard entry is intentionally special: anonymous users receive the
 * public-first Welcome experience, while authenticated users enter AI Workspace.
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

  // `/` is the application entry point, not an authentication screen.
  // Keep this decision here so deep-link and refresh behavior share one gate.
  if (page === 'dashboard' && !loading) {
    if (isAuthenticated) return <Navigate to="/ai" replace />
    return <Welcome />
  }

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
