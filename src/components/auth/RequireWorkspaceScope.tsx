import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { getWorkspaceHomeTarget } from '@/lib/workspaceNavigation'

export type PartnerWorkspaceScope = 'DIAGNOSTIC_CENTER' | 'LABORATORY' | 'ACADEMY'

type AuthLike = ReturnType<typeof useAuth>

export function workspaceScopeAllowed(
  user: AuthLike['user'] | null | undefined,
  effectiveRole: AuthLike['effectiveRole'],
  scopeType: PartnerWorkspaceScope,
  activeWorkspaceScopeType?: string | null,
): boolean {
  const typedUser = user as { platformRole?: string; role?: string; organizationType?: string } | null | undefined
  const role = String(typedUser?.platformRole || effectiveRole || typedUser?.role || '').toUpperCase()
  if (role === 'SUPERADMIN') return true
  // The selected IAM workspace is authoritative. The profile-level
  // organizationType can describe a legacy/default organization and must not
  // override a different organization the user explicitly switched into.
  const organizationType = String(activeWorkspaceScopeType || typedUser?.organizationType || '').toUpperCase()
  return organizationType === scopeType
}

export function RequireWorkspaceScope({
  scopeType,
  children,
}: {
  scopeType: PartnerWorkspaceScope
  children: React.ReactNode
}) {
  const location = useLocation()
  const { user, loading, effectiveRole, activeWorkspace, workspaceContexts } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  // A multi-organization user with no active IAM selection must choose one
  // before any protected workspace route can render. Never fall back to the
  // profile's legacy organizationType in this ambiguous state.
  if (!activeWorkspace && workspaceContexts.length > 0) {
    // The general shell hosts the all-organization WorkspaceSwitcher.
    // /my-clinics is clinic-only and would strand partner-only accounts.
    return <Navigate to="/" state={{ from: location }} replace />
  }
  if (workspaceScopeAllowed(user, effectiveRole, scopeType, activeWorkspace?.scopeType)) return <>{children}</>
  const activeHome = activeWorkspace ? getWorkspaceHomeTarget({
    scopeType: activeWorkspace.scopeType,
    roleKey: activeWorkspace.roleKey || activeWorkspace.role,
    hasClinic: activeWorkspace.scopeType === 'CLINIC',
  }) : null
  return <Navigate to={activeHome?.path || (scopeType === 'ACADEMY' ? '/school' : '/diagnostics')} replace />
}

export default RequireWorkspaceScope
