import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, BriefcaseBusiness, Building2, Check, FlaskConical,
  GraduationCap, RefreshCw, Store,
} from 'lucide-react'

import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { ListSkeleton } from '@/components/ui/ds/Skeleton'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useToast } from '@/components/ui/ds/Toast'
import { getWorkspaceHomeTarget } from '@/lib/workspaceNavigation'
import { resolveGlobalRoleLabel, selectWorkspaceContext, workspaceContextFrom } from '@/lib/workspaceContext'
import { queryKeys } from '@/queries/keys'
import { useAuth, useAuthStore, getRoleDisplayLabel } from '@/store/auth.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import * as api from '@/utils/api'

interface WorkspaceContext {
  id: string
  scopeType: string
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
}

const TYPE_LABEL: Record<string, string> = {
  CLINIC: 'Стоматологическая клиника',
  DIAGNOSTIC_CENTER: 'Диагностический центр',
  LABORATORY: 'Лаборатория',
  SUPPLIER: 'Поставщик стоматологических товаров',
  SUPPLIER_COMPANY: 'Поставщик стоматологических товаров',
  LECTURER: 'Преподаватель',
  ACADEMY: 'Учебная академия',
  PARTNER: 'Партнёр',
  EMPLOYER: 'Работодатель',
}

const TYPE_ICON: Record<string, typeof Building2> = {
  CLINIC: Building2,
  DIAGNOSTIC_CENTER: FlaskConical,
  LABORATORY: FlaskConical,
  SUPPLIER: Store,
  SUPPLIER_COMPANY: Store,
  LECTURER: GraduationCap,
  ACADEMY: GraduationCap,
  PARTNER: Building2,
  EMPLOYER: BriefcaseBusiness,
}

const TYPE_GROUP: Record<string, string> = {
  CLINIC: 'Стоматологии',
  DIAGNOSTIC_CENTER: 'Диагностика и лаборатории',
  LABORATORY: 'Диагностика и лаборатории',
  SUPPLIER: 'Поставщики и партнёры',
  SUPPLIER_COMPANY: 'Поставщики и партнёры',
  PARTNER: 'Поставщики и партнёры',
  LECTURER: 'Обучение',
  ACADEMY: 'Обучение',
  EMPLOYER: 'Работа и найм',
}

function groupOrder(label: string): number {
  const order = ['Стоматологии', 'Диагностика и лаборатории', 'Поставщики и партнёры', 'Обучение', 'Работа и найм', 'Другие пространства']
  return order.indexOf(label) < 0 ? order.length : order.indexOf(label)
}

export default function Workspaces() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user, isAuthenticated, activeWorkspace } = useAuth()
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace)
  const setContextFocus = useWorkspaceStore((state) => state.setContextFocus)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: workspaces = [], isLoading, isError, refetch } = useQuery<WorkspaceContext[]>({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const result = await api.getMyContexts()
      return (result.contexts || []) as WorkspaceContext[]
    },
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const current = useMemo(() => {
    if (activeWorkspace?.id) {
      const selected = workspaces.find((workspace) => workspace.id === activeWorkspace.id)
      if (selected) return selected
    }

    const identity = user as any
    return selectWorkspaceContext(workspaces, {
      scopeId: identity?.lecturerId || identity?.supplierId || identity?.clinicId || identity?.organizationOriginalId,
      organizationId: identity?.organizationId,
    })
  }, [workspaces, activeWorkspace?.id, user])

  const grouped = useMemo(() => {
    const groups = new Map<string, WorkspaceContext[]>()
    for (const workspace of workspaces) {
      const group = TYPE_GROUP[workspace.scopeType] || 'Другие пространства'
      groups.set(group, [...(groups.get(group) || []), workspace])
    }
    return Array.from(groups.entries())
      .sort(([left], [right]) => groupOrder(left) - groupOrder(right))
      .map(([label, items]) => ({ label, items: [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru')) }))
  }, [workspaces])

  const openWorkspace = async (workspace: WorkspaceContext) => {
    const home = getWorkspaceHomeTarget({
      scopeType: workspace.scopeType,
      roleKey: workspace.roleKey || workspace.role,
    })
    if (!home) {
      toast.error('Для этого рабочего пространства пока не настроен основной маршрут')
      return
    }

    if (busyId) return
    if (current?.id === workspace.id) {
      navigate(home.path)
      return
    }

    setBusyId(workspace.id)
    try {
      // Keep the legacy scope identity for supplier and lecturer tokens.
      const scopeId = workspace.scopeType === 'LECTURER' || workspace.scopeType === 'SUPPLIER'
        ? workspace.scopeId
        : (workspace.organizationId || workspace.scopeId)
      const tokens = await api.switchContext(workspace.scopeType, scopeId, workspace.branchId)
      if (tokens?.accessToken) api.setTokens(tokens.accessToken, tokens.refreshToken || null)
      await useAuthStore.getState().restoreSession()

      const contract = workspaceContextFrom(workspace, workspace.permissions || [])
      api.setWorkspaceContext(contract)
      setActiveWorkspace({
        id: workspace.id,
        scopeType: workspace.scopeType,
        organizationId: workspace.organizationId,
        branchId: workspace.branchId,
        name: workspace.name,
        roleKey: workspace.roleKey,
        roleLabel: workspace.roleLabel,
        permissions: workspace.permissions,
        participant: workspace.personType,
        dataScope: contract.dataScope,
      }, contract)
      setContextFocus('workspace', workspace.id, {
        organizationId: workspace.organizationId || null,
        branchId: workspace.branchId || null,
        roleKey: workspace.roleKey || workspace.role || null,
        scopeType: workspace.scopeType,
      })
      window.dispatchEvent(new CustomEvent('dentvision:workspace-switched', {
        detail: {
          id: workspace.id,
          scopeId: workspace.scopeId,
          scopeType: workspace.scopeType,
          organizationId: workspace.organizationId,
          branchId: workspace.branchId || null,
          name: workspace.name,
          roleLabel: workspace.roleLabel,
          roleKey: workspace.roleKey || null,
        },
      }))

      await queryClient.invalidateQueries({ queryKey: ['workspaces', user?.id] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })

      toast.success(`Открыто рабочее пространство: ${workspace.name}`)
      navigate(home.path)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось переключить рабочее пространство')
    } finally {
      setBusyId(null)
    }
  }

  if (!isAuthenticated) {
    return <EmptyState
      icon={<Building2 size={28} />}
      title="Войдите в DentVision"
      description="После входа здесь появятся все организации, в которых у вас есть рабочий доступ."
      action={<Button onClick={() => navigate('/login')}>Войти</Button>}
    />
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Рабочие пространства"
        subtitle="Все организации, роли и кабинеты, к которым у вас есть доступ"
        icon={<Building2 size={21} />}
        actions={(
          <Button variant="secondary" className="min-h-11" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw size={14} /> Обновить
          </Button>
        )}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold">
            <Building2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-txt-primary">Один аккаунт — несколько рабочих мест</p>
            <p className="mt-1 text-xs text-txt-muted">
              Выберите организацию, чтобы открыть её кабинет. Доступ и права определяются вашей ролью в этой организации.
            </p>
          </div>
          <Badge variant="outline">{workspaces.length} {workspaces.length === 1 ? 'пространство' : 'пространств'}</Badge>
        </CardContent>
      </Card>

      {isError && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-error">Не удалось загрузить рабочие пространства.</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title="Рабочих пространств пока нет"
          description="Создайте организацию или примите приглашение. Когда вы получите доступ, кабинет появится здесь."
          action={<Button onClick={() => navigate('/onboarding')}>Создать или присоединиться</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.label} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-txt-primary">{group.label}</h2>
                <span className="text-xs text-txt-muted">{group.items.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((workspace) => {
                  const active = current?.id === workspace.id
                  const Icon = TYPE_ICON[workspace.scopeType] || Building2
                  const loading = busyId === workspace.id
                  return (
                    <Card key={workspace.id} className={active ? 'border-dv-gold/50 bg-dv-gold/[0.035]' : undefined}>
                      <CardContent className="flex h-full flex-col gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-bdr-subtle bg-surface-2 text-txt-secondary">
                            <Icon size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-txt-primary">{workspace.name}</p>
                            <p className="mt-1 text-xs text-txt-muted">{TYPE_LABEL[workspace.scopeType] || 'Рабочая организация'}</p>
                            <p className="mt-1 text-xs text-txt-secondary">{workspace.roleLabel || resolveGlobalRoleLabel([workspace.roleKey || workspace.role], getRoleDisplayLabel)}</p>
                          </div>
                          {active && <Badge variant="success"><Check size={11} className="mr-1 inline" />Текущий кабинет</Badge>}
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-bdr-subtle pt-3">
                          <span className="text-[11px] text-txt-muted">
                            {workspace.branchId ? 'Доступ с учётом выбранного филиала' : 'Организационный доступ'}
                          </span>
                          <Button
                            size="sm"
                            className="min-h-10"
                            variant={active ? 'secondary' : 'primary'}
                            loading={loading}
                            disabled={Boolean(busyId) && !loading}
                            onClick={() => void openWorkspace(workspace)}
                          >
                            {active ? 'Открыть кабинет' : 'Перейти'} <ArrowRight size={13} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
