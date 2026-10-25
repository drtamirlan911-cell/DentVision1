import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'

export type PartnerWorkspaceScope = 'DIAGNOSTIC_CENTER' | 'LABORATORY'

type AuthLike = ReturnType<typeof useAuth>

export function workspaceScopeAllowed(
  user: AuthLike['user'] | null | undefined,
  effectiveRole: AuthLike['effectiveRole'],
  scopeType: PartnerWorkspaceScope,
): boolean {
  const typedUser = user as { platformRole?: string; role?: string; organizationType?: string } | null | undefined
  const role = String(typedUser?.platformRole || effectiveRole || typedUser?.role || '').toUpperCase()
  if (role === 'SUPERADMIN') return true
  const organizationType = String(typedUser?.organizationType || '').toUpperCase()
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
  const { user, loading, effectiveRole } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (workspaceScopeAllowed(user, effectiveRole, scopeType)) return <>{children}</>
  return <Navigate to="/diagnostics" replace />
}

export default RequireWorkspaceScope
