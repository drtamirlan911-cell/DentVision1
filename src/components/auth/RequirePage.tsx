import React from 'react'
import { Skeleton } from '@/components/ui/ds';
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useIam } from '@/iam'
import { firstAllowedCrmPath, pageIdFromPath } from '@/lib/roleAccess'
import Welcome from '@/pages/Welcome'

/**
 * Application-entry and authorization gate.
 * Authentication is deliberately separate from the public application entry.
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
  const iam = useIam()

  // `/` is public application entry. Authenticated users go directly to AI Workspace.
  if (page === 'dashboard' && !loading) {
    if (isAuthenticated) return <Navigate to="/ai" replace />
    return <Welcome />
  }

  // Public routes are intentionally not wrapped by this guard in index.tsx.
  // Never bypass authorization merely because a guest session exists: a guest
  // token grants anonymous capabilities, not access to CRM/platform data.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wait for auth hydration before evaluating role/page permissions.
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
