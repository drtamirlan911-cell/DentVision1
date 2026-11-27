import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BriefcaseBusiness, Building2, Check, ChevronDown, FlaskConical, GraduationCap, Loader2, Plus, Store, GitBranch } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getRoleDisplayLabel, useAuth, type WorkspaceContext as AuthWorkspaceContext } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { queryKeys } from '@/queries/keys'
import { resolveGlobalRoleLabel, selectWorkspaceContext } from '@/lib/workspaceContext'
import { getWorkspaceHomeTarget, resolveWorkspaceRoleLabel } from '@/lib/workspaceNavigation'
import * as api from '@/utils/api'

type ScopeType = 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'LABORATORY' | 'SUPPLIER' | 'LECTURER' | 'ACADEMY' | 'PARTNER' | 'EMPLOYER'

type WorkspaceContext = AuthWorkspaceContext & { scopeType: ScopeType; role?: string }

const TYPE_ICON: Record<ScopeType, typeof Building2> = {
  CLINIC: Building2,
  DIAGNOSTIC_CENTER: FlaskConical,
  LABORATORY: FlaskConical,
  SUPPLIER: Store,
  LECTURER: GraduationCap,
  ACADEMY: GraduationCap,
  PARTNER: Building2,
  EMPLOYER: BriefcaseBusiness,
}

function workspaceRoleLabel(workspace: WorkspaceContext): string {
  return resolveWorkspaceRoleLabel(
    workspace.roleKey,
    workspace.role,
    workspace.roleLabel,
    getRoleDisplayLabel,
  )
}

function workspaceTypeLabel(workspace: WorkspaceContext): string {
  const label = getWorkspaceHomeTarget({
    scopeType: workspace.scopeType,
    roleKey: workspace.roleKey || workspace.role,
  })?.label
  if (label) return label.replace(/^(?:Кабинет|Рабочее место)\s+/i, '')
  const fallback: Record<string, string> = {
    CLINIC: 'Стоматологическая клиника',
    DIAGNOSTIC_CENTER: 'Диагностический центр',
    LABORATORY: 'Лаборатория',
    SUPPLIER: 'Поставщик',
    LECTURER: 'Преподаватель',
    ACADEMY: 'Академия',
    PARTNER: 'Партнёр',
    EMPLOYER: 'Работодатель',
  }
  return fallback[workspace.scopeType] || 'Рабочая организация'
}

const GROUPS: Array<{ label: string; types: ScopeType[] }> = [
  { label: 'Клиники', types: ['CLINIC'] },
  { label: 'Диагностические центры', types: ['DIAGNOSTIC_CENTER'] },
  { label: 'Лаборатории', types: ['LABORATORY'] },
  { label: 'Поставщики', types: ['SUPPLIER'] },
  { label: 'Академия', types: ['LECTURER', 'ACADEMY'] },
  { label: 'Партнёры', types: ['PARTNER'] },
  { label: 'Работодатели', types: ['EMPLOYER'] },
]

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user, clinic, activeMembership, roleInfo, effectiveRole, isAuthenticated, activeWorkspace, switchWorkspace } = useAuth()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 304 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery<WorkspaceContext[]>({
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
    const maxHeight = Math.min(560, window.innerHeight - 24)
    const availableBelow = window.innerHeight - rect.bottom - 20
    const top = availableBelow >= Math.min(maxHeight, 280)
      ? rect.bottom + 8
      : Math.max(12, rect.top - maxHeight - 8)
    setMenuPosition({ top, left, width })
  }

  useEffect(() => {
    const openFromSidebar = () => {
      updateMenuPosition()
      setOpen(true)
    }
    window.addEventListener('dentvision:open-workspace-switcher', openFromSidebar)
    return () => window.removeEventListener('dentvision:open-workspace-switcher', openFromSidebar)
  }, [])

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
  }, [open, workspacesLoading])

  const activeClinicId = clinic?.id || activeMembership?.clinicId || null
  const activeOrgId = (user as { organizationId?: string } | null)?.organizationId || null
  const activeOrgType = (user as { organizationType?: string } | null)?.organizationType || null
  const activeSupplierId = (user as { supplierId?: string } | null)?.supplierId || null
  const activeLecturerId = (user as { lecturerId?: string } | null)?.lecturerId || null

  const isActive = useCallback((ws: WorkspaceContext) => {
    if (activeWorkspace?.id) return ws.id === activeWorkspace.id
    if (ws.scopeType === 'LECTURER') {
      return activeLecturerId ? ws.scopeId === activeLecturerId : Boolean(activeOrgId && ws.organizationId === activeOrgId)
    }
    if (ws.scopeType === 'SUPPLIER') {
      return activeSupplierId ? ws.scopeId === activeSupplierId : Boolean(activeOrgId && (ws.organizationId === activeOrgId || ws.scopeId === activeOrgId))
    }
    if (activeOrgType && activeOrgType !== 'CLINIC') return ws.organizationId === activeOrgId || ws.scopeId === activeOrgId
    return ws.scopeType === 'CLINIC' && ws.scopeId === activeClinicId
  }, [activeWorkspace?.id, activeClinicId, activeOrgId, activeOrgType, activeSupplierId, activeLecturerId])

  const current = useMemo(
    () => {
      const selected = activeWorkspace?.id ? workspaces.find((workspace) => workspace.id === activeWorkspace.id) : null
      if (selected) return selected
      const exact = workspaces.find(isActive)
      if (exact) return exact
      // Reuse the canonical fail-closed selector. A stale identity or an
      // ambiguous multi-membership state must never borrow the first workspace.
      return selectWorkspaceContext(workspaces, {
        scopeId: activeLecturerId || activeSupplierId || activeClinicId || activeOrgId,
        organizationId: activeOrgId,
      })
    },
    [workspaces, isActive, activeWorkspace?.id, activeOrgId, activeClinicId, activeSupplierId, activeLecturerId],
  )
  const isGenericRoleLabel = (label?: string | null) =>
    !label?.trim() || /^(?:участник(?: экосистемы)?|member|participant|user|пользователь)$/i.test(label.trim())
  const activeRoleLabel = useMemo(() => {
    if (!current) {
      // Global participants (student, patient, superadmin, support) may have no
      // organization workspace. Keep their authenticated role visible without
      // manufacturing or selecting an organization context.
      if (workspaces.length === 0) {
        return resolveGlobalRoleLabel(
          [effectiveRole, (user as any)?.role, (user as any)?.platformRole],
          getRoleDisplayLabel,
          roleInfo?.label,
        )
      }
      return t('platform.workspace_choose', { defaultValue: 'Контекст не выбран' })
    }
    // The selected membership is authoritative; global role is only a fallback
    // for accounts that have no organization workspace at all.
    const scopedLabel = resolveWorkspaceRoleLabel(
      current.roleKey,
      current.role,
      current.roleLabel,
      getRoleDisplayLabel,
    )
    if (!isGenericRoleLabel(scopedLabel)) return scopedLabel
    return 'Участник экосистемы'
  }, [current, workspaces.length, effectiveRole, user, roleInfo?.label, t])

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



  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: workspaces.filter((w) => g.types.includes(w.scopeType)) })).filter((g) => g.items.length > 0),
    [workspaces],
  )

  if (!isAuthenticated) return null
  if (workspacesLoading) return null
  if (workspaces.length === 0) {
    // Patients, students, platform support and other global participants may have
    // no organization workspace, but their active role must still be visible.
    return (
      <div
        data-testid="workspace-role-indicator"
        role="status"
        aria-label={`Роль: ${activeRoleLabel}`}
        title={activeRoleLabel}
        className={cn('flex min-h-11 items-center rounded-xl border border-bdr-strong bg-surface-raised px-3 text-xs font-semibold text-txt-primary', className)}
      >
        {activeRoleLabel}
      </div>
    )
  }

  const Icon = TYPE_ICON[current?.scopeType || 'CLINIC'] || Building2

  const pick = async (ws: WorkspaceContext) => {
    if (busyId) return
    const home = getWorkspaceHomeTarget({ scopeType: ws.scopeType, roleKey: ws.roleKey || ws.role })
    if (current?.id === ws.id) {
      setOpen(false)
      if (home) navigate(home.path)
      else if (ws.scopeType === 'CLINIC' && !location.pathname.startsWith('/crm')) navigate('/crm/schedule')
      return
    }

    setBusyId(ws.id)
    try {
      await switchWorkspace(ws)
      toast.success(`Активно рабочее пространство: ${ws.name}`)
      setOpen(false)

      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })

      if (home) navigate(home.path)
      else if (ws.scopeType === 'CLINIC' && !location.pathname.startsWith('/crm')) navigate('/crm/schedule')
    } catch (e) {
      toast.error((e as Error)?.message || 'Не удалось переключить рабочее пространство')
    } finally {
      setBusyId(null)
    }
  }

  const pickBranch = async (branch: BranchOption) => {
    if (!current || busyId) return
    if (current.branchId === branch.id) { setOpen(false); return }
    setBusyId(`branch:${branch.id}`)
    try {
      const selected = { ...current, branchId: branch.id }
      await switchWorkspace(selected)
      queryClient.setQueryData<WorkspaceContext[]>(
        ['workspaces', user?.id],
        (items) => items?.map((item) =>
          item.id === selected.id ? { ...item, branchId: branch.id } : item,
        ),
      )
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
      className="fixed z-[1000] rounded-2xl border border-bdr-strong bg-surface-raised shadow-elev-3 p-1.5 overflow-y-auto overscroll-contain"
      style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: Math.min(560, window.innerHeight - menuPosition.top - 12) }}
      role="menu"
      aria-label="Организация и филиал"
      data-testid="workspace-switcher-menu"
    >
      <div className="px-2 py-1.5 border-b border-bdr-subtle mb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-txt-muted">Организация и филиал</p>
        <p className="text-[11px] text-txt-secondary mt-0.5">Выберите организацию, рабочий кабинет и филиал</p>
      </div>
      <div className="space-y-1">
        {grouped.map((group) => (
          <div key={group.label}>
            {grouped.length > 1 && <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-txt-muted">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((ws) => {
                const WsIcon = TYPE_ICON[ws.scopeType] || Building2
                const active = current?.id === ws.id
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
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold truncate">{ws.name}</span>
                      <span className="block text-[10px] text-txt-muted truncate">{workspaceTypeLabel(ws)} · {workspaceRoleLabel(ws)}</span>
                    </span>
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
      <button type="button" onClick={() => { setOpen(false); navigate('/workspaces') }} className="mt-1 w-full flex items-center gap-2 px-2.5 py-2 min-h-11 rounded-xl border border-transparent text-xs font-medium text-txt-secondary hover:text-txt-primary hover:bg-surface-2 hover:border-bdr-subtle transition-colors"><Building2 size={14} />Все рабочие пространства</button>
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
        aria-label={activeRoleLabel ? `Переключить рабочее пространство: ${current?.name || t('platform.workspace_choose', { defaultValue: 'Выберите рабочее пространство' })} — ${activeRoleLabel}` : 'Переключить рабочее пространство'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-6 w-6 rounded-lg bg-dv-gold/12 border border-dv-gold/25 flex items-center justify-center shrink-0"><Icon size={13} className="text-dv-gold" /></span>
        <span className="min-w-0 text-left leading-tight"><span className="block text-xs font-semibold truncate">{current?.name || t('platform.workspace_choose', { defaultValue: 'Выберите рабочее пространство' })}</span><span className="block text-[9px] font-medium text-txt-muted truncate">{activeRoleLabel}</span></span>
        <ChevronDown size={13} className={cn('shrink-0 text-txt-muted transition-transform', open && 'rotate-180')} />
      </button>
      {menu}
    </div>
  )
}

export default WorkspaceSwitcher
