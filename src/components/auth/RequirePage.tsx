import React from 'react'
import { Skeleton } from '@/components/ui/ds';
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useIam } from '@/iam'
import { firstAllowedCrmPath, pageIdFromPath } from '@/lib/roleAccess'
import { getWorkspaceNavigationGroups, isWorkspaceNavigationActive } from '@/lib/workspaceNavigation'
import Welcome from '@/pages/Welcome'

/**
 * Application-entry and authorization gate.
 * Authentication is deliberately separate from the public application entry.
 */
/**
 * Partner cabinet routes are authorized from the active organization scope.
 * Diagnostic subroutes are additionally matched against the active role's
 * own sidebar destinations. Server APIs remain the final data authorization.
 */
export function isScopedWorkspaceRouteAllowed(
  pageId: string | null | undefined,
  scopeType?: string | null,
  roleKey?: string | null,
  pathname?: string,
  search?: string,
): boolean {
  const scope = String(scopeType || '').trim().toUpperCase()
  if (pageId === 'supplier') return scope === 'SUPPLIER' || scope === 'SUPPLIER_COMPANY'
  if (pageId === 'employer') return scope === 'EMPLOYER' || scope === 'CLINIC'
  if (pageId === 'school') return scope === 'LECTURER'
  if (
    scope === 'DIAGNOSTIC_CENTER' || scope === 'LABORATORY'
    || scope === 'MEDICAL_LAB' || scope === 'MEDICAL_LABORATORY'
    || scope === 'DENTAL_LAB' || scope === 'DENTAL_LABORATORY'
  ) {
    if (!String(pageId || '').startsWith('diagnostics')) return false
    const groups = getWorkspaceNavigationGroups(scope, roleKey)
    return groups.some((group) => group.items.some((item) =>
      isWorkspaceNavigationActive(pathname || '', search || '', item.path),
    ))
  }
  return false
}

export function RequirePage({
  page,
  children,
}: {
  /** Explicit page id; if omitted, derived from current path. */
  page?: string
  children: React.ReactNode
}) {
  const location = useLocation()
  const { isAuthenticated, loading, activeWorkspace } = useAuth()
  const iam = useIam()

  // `/` is public application entry. Authenticated users go directly to AI Workspace.
  if (page === 'dashboard' && !loading) {
    if (isAuthenticated) return <Navigate to="/ai" replace />
    return <Welcome />
  }

  // Wait for auth hydration before evaluating authentication or page permissions.
  // A full document navigation starts with an empty auth store; redirecting before
  // restoreSession() completes would incorrectly send authenticated users to /login.
  if (loading) {
    return (
      <div className="dv-page py-6 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton variant="text" lines={4} />
      </div>
    )
  }

  // Public routes are intentionally not wrapped by this guard in index.tsx.
  // Never bypass authorization merely because a guest session exists: a guest
  // token grants anonymous capabilities, not access to CRM/platform data.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const pageId = page || pageIdFromPath(location.pathname)
  const allowed = iam.pages

  // Supplier is a workspace, not a clinic/platform role. It must be reachable only
  // while the authenticated session is actually scoped to a supplier workspace;
  // otherwise /supplier becomes a cross-context data boundary bypass.
  const scopedPartnerRoute = isScopedWorkspaceRouteAllowed(
    pageId,
    activeWorkspace?.scopeType,
    activeWorkspace?.roleKey || activeWorkspace?.role,
    location.pathname,
    location.search,
  )
  const supplierWorkspace = pageId === 'supplier' && scopedPartnerRoute
  const employerWorkspace = pageId === 'employer' && scopedPartnerRoute

  // Supplier is a separate organization workspace. Never let a clinic,
  // platform, or generic role's page permissions accidentally expose it.
  if (pageId === 'employer' && !employerWorkspace) {
    return <Navigate to="/ai" replace />
  }

  if (pageId === 'supplier' && !supplierWorkspace) {
    // Do not fall back to a clinic route: platform-wide permissions do not create
    // a clinic or supplier workspace.
    return <Navigate to="/ai" replace />
  }

  if (scopedPartnerRoute) {
    return <>{children}</>
  }

  if (iam.canAccessPage(pageId)) {
    return <>{children}</>
  }

  return <Navigate to={firstAllowedCrmPath(allowed)} replace />
}

export default RequirePage
