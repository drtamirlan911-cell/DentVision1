import { useAuth } from '@/store/auth.store'

export interface DiagnosticsOrgScope {
  /** Set when the caller is clinic staff referring out (a doctor/assistant). */
  clinicId: string
  /** Set when the caller belongs to the receiving org instead of a clinic. */
  orgKind: 'CENTER' | 'LAB' | null
  orgId: string
}

/**
 * Resolves whether the current user is scoped to diagnostics data as clinic
 * staff (referring doctor) or as staff of their own diagnostic centre/lab
 * (receiving org) — mirrors `DiagnosticWorkspace`'s `claimedKind` logic.
 * Pages that only ever scoped by `clinicId` left LAB/CENTER staff with a
 * permanently-disabled query and a silently empty screen.
 */
export function useDiagnosticsOrgScope(): DiagnosticsOrgScope {
  const { user, clinic, activeMembership } = useAuth()
  const clinicId = clinic?.id || activeMembership?.clinicId || ''
  const orgKind: 'CENTER' | 'LAB' | null =
    user?.organizationType === 'LABORATORY' ? 'LAB'
      : user?.organizationType === 'DIAGNOSTIC_CENTER' ? 'CENTER'
        : null
  const orgId = orgKind ? (user?.organizationId || '') : ''
  return { clinicId, orgKind, orgId }
}
