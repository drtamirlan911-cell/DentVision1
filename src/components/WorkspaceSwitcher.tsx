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
    () => GROUPS.map((g) => ({ ...g, items: workspaces.filter((w) => g.types.includes(w.scopeType)) })).filter((g) => g.items.length > 0),
    [workspaces],
  )

  if (!isAuthenticated || workspaces.length === 0) return null

  const multi = workspaces.length > 1
  const Icon = TYPE_ICON[current?.scopeType || 'CLINIC'] || Building2

  const pick = async (ws: WorkspaceContext) => {
    if (busyId || isActive(ws)) { setOpen(false); return }
    setBusyId(ws.id)
    try {
      const tokens = await api.switchContext(ws.scopeType, ws.organizationId || ws.scopeId)
      if (tokens?.accessToken) api.setTokens(tokens.accessToken, tokens.refreshToken || null)
      await useAuthStore.getState().restoreSession()

      toast.success(t('platform.clinic_active', { name: ws.name }))
      setOpen(false)

      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })

      switch (ws.scopeType) {
        case 'CLINIC':
          if (!location.pathname.startsWith('/crm')) navigate('/crm/schedule')
          break
        case 'DIAGNOSTIC_CENTER':
          navigate('/diagnostics/center-dashboard')
          break
        case 'LABORATORY':
          navigate('/diagnostics/lab-dashboard')
          break
        case 'SUPPLIER':
          navigate('/supplier')
          break
        case 'LECTURER':
        case 'ACADEMY':
          navigate('/school-workspace')
          break
        case 'PARTNER':
          navigate('/shop')
          break
      }
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
          'group flex items-center gap-2 max-w-[8.5rem] xs:max-w-[10rem] sm:max-w-[16rem] min-h-9 px-2.5 py-1.5 rounded-xl',
          'bg-surface-raised border border-bdr-strong text-txt-primary shadow-elev-1 hover:bg-surface-raised-hover hover:border-dv-gold/60 hover:shadow-elev-2 transition-[background-color,border-color,box-shadow] duration-150',
          open && 'border-dv-gold/70 shadow-elev-2',
        )}
        aria-label={multi ? t('platform.clinic_switch') : t('platform.my_clinics')}
        aria-expanded={multi ? open : undefined}
      >
        <span className="h-6 w-6 rounded-lg bg-dv-gold/12 border border-dv-gold/25 flex items-center justify-center shrink-0">
          <Icon size={13} className="text-dv-gold" />
        </span>
        <span className="text-xs font-semibold truncate">{current?.name || t('platform.clinic_fallback')}</span>
        {multi && <ChevronDown size={13} className={cn('shrink-0 text-txt-muted transition-transform', open && 'rotate-180')} />}
      </button>

      {multi && open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[min(19rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] rounded-2xl border border-bdr-strong bg-surface-raised shadow-elev-3 p-1.5">
          <div className="px-2 py-1.5 border-b border-bdr-subtle mb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-txt-muted">Рабочее пространство</p>
            <p className="text-[11px] text-txt-secondary mt-0.5">Выберите контекст DentVision</p>
          </div>
          <div className="max-h-[min(60vh,26rem)] overflow-y-auto space-y-1">
            {grouped.map((group) => (
              <div key={group.label}>
                {grouped.length > 1 && <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-txt-muted">{group.label}</p>}
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
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 min-h-12 rounded-xl text-left border transition-[background-color,border-color,color] duration-150 disabled:opacity-60',
                          active
                            ? 'border-dv-gold/50 bg-dv-gold/10 text-txt-primary'
                            : 'border-transparent text-txt-primary hover:border-bdr-subtle hover:bg-surface-2',
                        )}
                      >
                        <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border', active ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'bg-surface-2 border-bdr-subtle text-txt-secondary')}>
                          <WsIcon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold truncate">{ws.name}</span>
                          <span className="block text-[10px] text-txt-muted truncate">{ws.roleLabel}</span>
                        </span>
                        {loading ? <Loader2 size={15} className="animate-spin shrink-0 text-dv-gold" /> : active ? <Check size={15} className="shrink-0 text-dv-gold" /> : null}
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
            className="mt-1 w-full flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-xl border border-transparent text-xs font-medium text-txt-secondary hover:text-txt-primary hover:bg-surface-2 hover:border-bdr-subtle transition-colors"
          >
            <Plus size={14} />
            {t('platform.all_clinics')}
          </button>
        </div>
      )}
    </div>
  )
}

export default WorkspaceSwitcher
