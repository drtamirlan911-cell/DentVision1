import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronDown, FlaskConical, GraduationCap, Loader2, Plus, Store, GitBranch } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getRoleDisplayLabel, useAuth, useAuthStore } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { queryKeys } from '@/queries/keys'
import { useWorkspaceStore } from '@/store/workspace.store'
import { workspaceContextFrom } from '@/lib/workspaceContext'
import * as api from '@/utils/api'

type ScopeType = 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'LABORATORY' | 'SUPPLIER' | 'LECTURER' | 'ACADEMY' | 'PARTNER'

interface WorkspaceContext {
  id: string
  scopeType: ScopeType
  scopeId: string
  organizationId?: string
  branchId?: string
  permissions?: string[]
  ownDataOnly?: boolean
  roleKey?: string
  role?: string
  personType?: string | null
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
  const { user, clinic, activeMembership, roleInfo, isAuthenticated } = useAuth()
  const setActiveWorkspace = useWorkspaceStore(s => s.setActiveWorkspace)
  const setContextFocus = useWorkspaceStore(s => s.setContextFocus)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 304 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { data: workspaces = [] } = useQuery<WorkspaceContext[]>({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await api.getMyContexts()
      return (res.contexts || []) as WorkspaceContext[]
    },
    enabled: !!user && isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(304, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const top = Math.min(rect.bottom + 8, window.innerHeight - 24)
    setMenuPosition({ top, left, width })
  }

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onViewport = () => updateMenuPosition()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onViewport)
    window.addEventListener('scroll', onViewport, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onViewport)
      window.removeEventListener('scroll', onViewport, true)
    }
  }, [open])

  const activeClinicId = clinic?.id || activeMembership?.clinicId || null
  const activeOrgId = (user as { organizationId?: string } | null)?.organizationId || null
  const activeOrgType = (user as { organizationType?: string } | null)?.organizationType || null
  const activeSupplierId = (user as { supplierId?: string } | null)?.supplierId || null
  const activeLecturerId = (user as { lecturerId?: string } | null)?.lecturerId || null

  const isActive = useCallback((ws: WorkspaceContext) => {
    if (ws.scopeType === 'LECTURER') {
      return activeLecturerId ? ws.scopeId === activeLecturerId : Boolean(activeOrgId && ws.organizationId === activeOrgId)
    }
    if (ws.scopeType === 'SUPPLIER') {
      return activeSupplierId ? ws.scopeId === activeSupplierId : Boolean(activeOrgId && (ws.organizationId === activeOrgId || ws.scopeId === activeOrgId))
    }
    if (activeOrgType && activeOrgType !== 'CLINIC') return ws.organizationId === activeOrgId || ws.scopeId === activeOrgId
    return ws.scopeType === 'CLINIC' && ws.scopeId === activeClinicId
  }, [activeClinicId, activeOrgId, activeOrgType, activeSupplierId, activeLecturerId])

  const current = useMemo(
    () => workspaces.find(isActive) || workspaces.find((w) => w.scopeType === 'CLINIC') || workspaces[0],
    [workspaces, isActive],
  )
  const activeRoleLabel = current?.roleLabel || roleInfo?.label || getRoleDisplayLabel((user as any)?.platformRole || (user as any)?.role) || 'Участник экосистемы'

  interface BranchOption { id: string; name: string; code?: string | null; active?: boolean }
  const { data: branches = [], isFetching: branchesLoading } = useQuery<BranchOption[]>({
    queryKey: ['workspace-branches', current?.organizationId || current?.scopeId],
    queryFn: async () => {
      if (!current) return []
      const params = current.organizationId ? { organizationId: current.organizationId } : current.scopeType === 'CLINIC' ? { clinicId: current.scopeId } : {}
      if (!params.organizationId && !params.clinicId) return []
      return (await api.listBranches(params)) as BranchOption[]
    },
    enabled: open && !!current && isAuthenticated,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!current) return
    const contract = workspaceContextFrom(current, current.permissions || [])
    api.setWorkspaceContext(contract)
    setActiveWorkspace({
      id: current.id,
      scopeType: current.scopeType,
      organizationId: current.organizationId,
      branchId: current.branchId,
      name: current.name,
      roleKey: current.roleKey,
      roleLabel: current.roleLabel,
      permissions: current.permissions,
      participant: current.personType,
      dataScope: contract.dataScope,
    }, contract)
  }, [current, setActiveWorkspace])

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: workspaces.filter((w) => g.types.includes(w.scopeType)) })).filter((g) => g.items.length > 0),
    [workspaces],
  )

  if (!isAuthenticated || workspaces.length === 0) return null

  const Icon = TYPE_ICON[current?.scopeType || 'CLINIC'] || Building2

  const pick = async (ws: WorkspaceContext) => {
    if (busyId || isActive(ws)) {
      setOpen(false)
      return
    }
    setBusyId(ws.id)
    try {
      // Lecturer/supplier workspaces have their own legacy scope identities. Switching
      // through the organization id would collapse a lecturer into the academy (and
      // can leave the AI on the previous clinic scope). Preserve the selected scope
      // so the JWT carries lecturerId/supplierId and the server can rebuild the same workspace.
      const switchScopeId = ws.scopeType === 'LECTURER' || ws.scopeType === 'SUPPLIER'
        ? ws.scopeId
        : (ws.organizationId || ws.scopeId)
      const tokens = await api.switchContext(ws.scopeType, switchScopeId, ws.branchId)
      if (tokens?.accessToken) api.setTokens(tokens.accessToken, tokens.refreshToken || null)
      await useAuthStore.getState().restoreSession()

      const contract = workspaceContextFrom(ws, ws.permissions || [])
      api.setWorkspaceContext(contract)
      setActiveWorkspace({ id: ws.id, scopeType: ws.scopeType, organizationId: ws.organizationId, branchId: ws.branchId, name: ws.name, roleKey: ws.roleKey, roleLabel: ws.roleLabel, permissions: ws.permissions, participant: ws.personType, dataScope: contract.dataScope }, contract)
      setContextFocus('workspace', ws.id, { organizationId: ws.organizationId || null, branchId: ws.branchId || null, roleKey: ws.roleKey || ws.role || null, scopeType: ws.scopeType })
      window.dispatchEvent(new CustomEvent('dentvision:workspace-switched', { detail: { id: ws.id, scopeType: ws.scopeType, organizationId: ws.organizationId, branchId: ws.branchId || null, name: ws.name, roleLabel: ws.roleLabel, roleKey: ws.roleKey || null } }))

      toast.success(t('platform.clinic_active', { name: ws.name }))
      setOpen(false)

      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })

      switch (ws.scopeType) {
        case 'CLINIC': if (!location.pathname.startsWith('/crm')) navigate('/crm/schedule'); break
        case 'DIAGNOSTIC_CENTER': navigate('/diagnostics/center-dashboard'); break
        case 'LABORATORY': navigate('/diagnostics/lab-dashboard'); break
        case 'SUPPLIER': navigate('/supplier'); break
        case 'LECTURER':
        case 'ACADEMY': navigate('/school'); break
        case 'PARTNER': navigate('/shop'); break
      }
    } catch (e) {
      toast.error((e as Error)?.message || t('platform.clinic_switch_error'))
    } finally {
      setBusyId(null)
    }
  }

  const pickBranch = async (branch: BranchOption) => {
    if (!current || busyId) return
    if (current.branchId === branch.id) { setOpen(false); return }
    setBusyId(`branch:${branch.id}`)
    try {
      const switchScopeId = current.scopeType === 'LECTURER' || current.scopeType === 'SUPPLIER'
        ? current.scopeId
        : (current.organizationId || current.scopeId)
      const tokens = await api.switchContext(current.scopeType, switchScopeId, branch.id)
      if (tokens?.accessToken) api.setTokens(tokens.accessToken, tokens.refreshToken || null)
      await useAuthStore.getState().restoreSession()

      const selected = { ...current, branchId: branch.id }
      const contract = workspaceContextFrom(selected, selected.permissions || [])
      api.setWorkspaceContext(contract)
      setActiveWorkspace({ id: selected.id, scopeType: selected.scopeType, organizationId: selected.organizationId, branchId: selected.branchId, name: selected.name, roleKey: selected.roleKey, roleLabel: selected.roleLabel, permissions: selected.permissions, participant: selected.personType, dataScope: contract.dataScope }, contract)
      setContextFocus('workspace', selected.id, { organizationId: selected.organizationId || null, branchId: branch.id, roleKey: selected.roleKey || selected.role || null, scopeType: selected.scopeType })
      window.dispatchEvent(new CustomEvent('dentvision:workspace-switched', { detail: { id: selected.id, scopeType: selected.scopeType, organizationId: selected.organizationId, branchId: branch.id, name: selected.name, roleLabel: selected.roleLabel, roleKey: selected.roleKey || null } }))
      toast.success(`Филиал: ${branch.name}`)
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось переключить филиал')
    } finally {
      setBusyId(null)
    }
  }

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      className="fixed z-[1000] rounded-2xl border border-bdr-strong bg-surface-raised shadow-elev-3 p-1.5"
      style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: 'calc(100vh - 24px)' }}
      role="menu"
      aria-label="Рабочее пространство"
      data-testid="workspace-switcher-menu"
    >
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
                    className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 min-h-12 rounded-xl text-left border transition-[background-color,border-color,color] duration-150 disabled:opacity-60', active ? 'border-dv-gold/50 bg-dv-gold/10 text-txt-primary' : 'border-transparent text-txt-primary hover:border-bdr-subtle hover:bg-surface-2')}
                  >
                    <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border', active ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'bg-surface-2 border-bdr-subtle text-txt-secondary')}><WsIcon size={15} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{ws.name}</span><span className="block text-[10px] text-txt-muted truncate">{ws.roleLabel}</span></span>
                    {loading ? <Loader2 size={15} className="animate-spin shrink-0 text-dv-gold" /> : active ? <Check size={15} className="shrink-0 text-dv-gold" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {current && (branchesLoading || branches.length > 0) && (
        <div className="mt-1 border-t border-bdr-subtle pt-1.5">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">Филиалы</p>
            {branchesLoading && <Loader2 size={12} className="animate-spin text-txt-muted" />}
          </div>
          <div className="space-y-0.5">
            {branches.map((branch) => {
              const active = current.branchId === branch.id
              const loading = busyId === `branch:${branch.id}`
              return (
                <button key={branch.id} type="button" disabled={!!busyId} onClick={() => void pickBranch(branch)} aria-current={active ? 'true' : undefined}
                  className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 min-h-11 rounded-xl text-left border transition-[background-color,border-color,color] duration-150 disabled:opacity-60', active ? 'border-dv-gold/50 bg-dv-gold/10 text-txt-primary' : 'border-transparent text-txt-primary hover:border-bdr-subtle hover:bg-surface-2')}>
                  <span className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border', active ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'bg-surface-2 border-bdr-subtle text-txt-secondary')}><GitBranch size={14} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{branch.name}</span>{branch.code && <span className="block text-[10px] text-txt-muted truncate">{branch.code}</span>}</span>
                  {loading ? <Loader2 size={14} className="animate-spin shrink-0 text-dv-gold" /> : active ? <Check size={14} className="shrink-0 text-dv-gold" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <button type="button" onClick={() => { setOpen(false); navigate('/my-clinics') }} className="mt-1 w-full flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-xl border border-transparent text-xs font-medium text-txt-secondary hover:text-txt-primary hover:bg-surface-2 hover:border-bdr-subtle transition-colors"><Plus size={14} />{t('platform.all_clinics')}</button>
    </div>,
    document.body,
  ) : null

  return (
    <div ref={rootRef} className={cn('relative z-[60]', className)}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="workspace-switcher-trigger"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => { if (!open) updateMenuPosition(); setOpen((v) => !v) }}
        className={cn('group flex items-center gap-2 max-w-[8.5rem] xs:max-w-[10rem] sm:max-w-[16rem] min-h-11 px-2.5 py-1.5 rounded-xl', 'bg-surface-raised border border-bdr-strong text-txt-primary shadow-elev-1 hover:bg-surface-raised-hover hover:border-dv-gold/60 hover:shadow-elev-2 transition-[background-color,border-color,box-shadow] duration-150', open && 'border-dv-gold/70 shadow-elev-2')}
        aria-label={activeRoleLabel ? `${t('platform.clinic_switch')}: ${current?.name || t('platform.clinic_fallback')} — ${activeRoleLabel}` : t('platform.clinic_switch')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-6 w-6 rounded-lg bg-dv-gold/12 border border-dv-gold/25 flex items-center justify-center shrink-0"><Icon size={13} className="text-dv-gold" /></span>
        <span className="min-w-0 text-left leading-tight"><span className="block text-xs font-semibold truncate">{current?.name || t('platform.clinic_fallback')}</span><span className="block text-[9px] font-medium text-txt-muted truncate">{activeRoleLabel}</span></span>
        <ChevronDown size={13} className={cn('shrink-0 text-txt-muted transition-transform', open && 'rotate-180')} />
      </button>
      {menu}
    </div>
  )
}

export default WorkspaceSwitcher
