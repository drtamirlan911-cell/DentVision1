import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronDown, FlaskConical, GraduationCap, Loader2, Plus, Store } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth, useAuthStore } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { queryKeys } from '@/queries/keys'
import * as api from '@/utils/api'

/**
 * The one place to change which workspace you are in.
 *
 * There used to be two of these in the header side by side — a clinic-only
 * switcher and a workspace switcher — showing the same building icon, the same
 * clinic name, and both labelled "workspace". They were not redundant so much
 * as contradictory: the second one listed each clinic two or three times
 * (`/me/contexts` returned the legacy and unified rows for one clinic, and the
 * component then unshifted the active clinic on top without checking), and its
 * unified rows switched with `Organization.id`, which matches no clinic. It
 * also reloaded the whole page where the other switched softly.
 *
 * This keeps the behaviour that worked — soft switch, toast, cache
 * invalidation, no reload — and widens it to every workspace type. Dedup and a
 * single vocabulary now come from the endpoint (`modules/iam/contexts.ts`),
 * which is where they belong: all six callers of `getMyContexts` were seeing
 * the duplicates.
 */

type ScopeType = 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'LABORATORY' | 'SUPPLIER' | 'LECTURER' | 'ACADEMY' | 'PARTNER'

interface WorkspaceContext {
  id: string
  scopeType: ScopeType
  scopeId: string
  organizationId?: string
  name: string
  roleLabel: string
  logo?: string | null
}

const TYPE_ICON: Record<ScopeType, typeof Building2> = {
  CLINIC: Building2,
  DIAGNOSTIC_CENTER: FlaskConical,
  LABORATORY: FlaskConical,
  SUPPLIER: Store,
  LECTURER: GraduationCap,
  ACADEMY: GraduationCap,
  PARTNER: Building2,
}

/** Sections, in the order a dentist thinks about them. */
const GROUPS: Array<{ label: string; types: ScopeType[] }> = [
  { label: 'Клиники', types: ['CLINIC'] },
  { label: 'Диагностика', types: ['DIAGNOSTIC_CENTER', 'LABORATORY'] },
  { label: 'Поставщики', types: ['SUPPLIER'] },
  { label: 'Академия', types: ['LECTURER', 'ACADEMY'] },
  { label: 'Партнёры', types: ['PARTNER'] },
]

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user, clinic, activeMembership, isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const { data: workspaces = [] } = useQuery<WorkspaceContext[]>({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await api.getMyContexts()
      return (res.contexts || []) as WorkspaceContext[]
    },
    enabled: !!user && isAuthenticated,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const activeClinicId = clinic?.id || activeMembership?.clinicId || null
  const activeOrgId = (user as { organizationId?: string } | null)?.organizationId || null
  const activeOrgType = (user as { organizationType?: string } | null)?.organizationType || null

  const isActive = (ws: WorkspaceContext) => {
    // Outside a clinic the token carries the organisation; inside one the
    // clinic id is the truth, because a clinic token keeps organizationType
    // 'CLINIC' without necessarily naming which.
    if (activeOrgType && activeOrgType !== 'CLINIC') {
      return ws.organizationId === activeOrgId || ws.scopeId === activeOrgId
    }
    return ws.scopeType === 'CLINIC' && ws.scopeId === activeClinicId
  }

  const current = useMemo(
    () => workspaces.find(isActive) || workspaces.find((w) => w.scopeType === 'CLINIC') || workspaces[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaces, activeClinicId, activeOrgId, activeOrgType],
  )

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, items: workspaces.filter((w) => g.types.includes(w.scopeType)) }))
        .filter((g) => g.items.length > 0),
    [workspaces],
  )

  if (!isAuthenticated || workspaces.length === 0) return null

  const multi = workspaces.length > 1
  const Icon = TYPE_ICON[current?.scopeType || 'CLINIC'] || Building2

  const pick = async (ws: WorkspaceContext) => {
    if (busyId || isActive(ws)) { setOpen(false); return }
    setBusyId(ws.id)
    try {
      // One endpoint for every type. It resolves the unified Person path when
      // there is one and falls back to the legacy membership when there is not,
      // so the caller does not have to know which world a workspace lives in.
      const tokens = await api.switchContext(ws.scopeType, ws.organizationId || ws.scopeId)
      if (tokens?.accessToken) api.setTokens(tokens.accessToken, tokens.refreshToken || null)
      await useAuthStore.getState().restoreSession()

      toast.success(t('platform.clinic_active', { name: ws.name }))
      setOpen(false)

      // The new scope has its own data; the old scope's caches are stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })

      if (ws.scopeType === 'CLINIC' && !location.pathname.startsWith('/crm')) navigate('/crm/schedule')
      if (ws.scopeType === 'DIAGNOSTIC_CENTER') navigate('/diagnostics/center-dashboard')
      if (ws.scopeType === 'LABORATORY') navigate('/diagnostics/lab-dashboard')
      if (ws.scopeType === 'SUPPLIER') navigate('/supplier')
    } catch (e) {
      toast.error((e as Error)?.message || t('platform.clinic_switch_error'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (multi ? setOpen((v) => !v) : navigate('/my-clinics'))}
        className={cn(
          'flex items-center gap-1.5 max-w-[7.25rem] xs:max-w-[8.5rem] sm:max-w-[14rem] min-h-8 px-2 py-1 rounded-lg',
          'bg-surface-2 border border-bdr-subtle text-txt-secondary hover:text-txt-primary hover:border-dv-gold/30 transition-colors',
        )}
        aria-label={multi ? t('platform.clinic_switch') : t('platform.my_clinics')}
        aria-expanded={multi ? open : undefined}
      >
        <Icon size={13} className="text-dv-gold shrink-0" />
        <span className="text-[11px] font-medium truncate">{current?.name || t('platform.clinic_fallback')}</span>
        {multi && <ChevronDown size={12} className={cn('shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />}
      </button>

      {multi && open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-[min(17rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl p-1.5">
          <div className="max-h-[min(60vh,26rem)] overflow-y-auto space-y-1">
            {grouped.map((group) => (
              <div key={group.label}>
                {/* Sections only earn their keep once there is more than one. */}
                {grouped.length > 1 && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-txt-ghost">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((ws) => {
                    const WsIcon = TYPE_ICON[ws.scopeType] || Building2
                    const active = isActive(ws)
                    const loading = busyId === ws.id
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void pick(ws)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-2 min-h-11 rounded-lg text-left transition-colors disabled:opacity-60',
                          active ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-primary hover:bg-surface-2',
                        )}
                      >
                        <span className="h-7 w-7 rounded-md flex items-center justify-center bg-dv-gold/10 text-dv-gold shrink-0">
                          <WsIcon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold truncate">{ws.name}</span>
                          <span className="block text-[10px] text-txt-muted truncate">{ws.roleLabel}</span>
                        </span>
                        {loading ? (
                          <Loader2 size={14} className="animate-spin shrink-0" />
                        ) : active ? (
                          <Check size={14} className="shrink-0" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/my-clinics') }}
            className="mt-1 w-full flex items-center gap-2 px-2 py-2 min-h-11 rounded-lg text-xs text-txt-secondary hover:text-txt-primary hover:bg-surface-2 transition-colors"
          >
            <Plus size={13} />
            {t('platform.all_clinics')}
          </button>
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher
