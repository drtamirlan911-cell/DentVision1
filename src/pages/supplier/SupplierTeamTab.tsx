import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, Trash2, UserPlus, Users, X } from 'lucide-react'

import * as api from '@/utils/api'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Input } from '@/components/ui/ds/Input'
import { useToast } from '@/components/ui/ds/Toast'
import { ListSkeleton } from '@/components/ui/ds/Skeleton'

interface SupplierTeamMember {
  id: string
  userId: string
  role: string
  firstName?: string
  lastName?: string
  email?: string
}

interface SupplierInvitation {
  id: string
  code: string
  role: string
  email?: string | null
  expiresAt?: string | null
}

interface SupplierTeamTabProps {
  token: string
  supplierId: string
  organizationId: string
}

function rowsFrom<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const response = value as { data?: unknown; items?: unknown }
    if (Array.isArray(response.data)) return response.data as T[]
    if (Array.isArray(response.items)) return response.items as T[]
  }
  return []
}

function roleTitle(role: string): string {
  if (role === 'owner') return 'Владелец'
  if (role === 'manager') return 'Менеджер'
  return 'Сотрудник'
}

export default function SupplierTeamTab({ token, supplierId, organizationId }: SupplierTeamTabProps) {
  const toast = useToast()
  const [team, setTeam] = useState<SupplierTeamMember[]>([])
  const [invitations, setInvitations] = useState<SupplierInvitation[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingInvite, setSavingInvite] = useState(false)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const requestGeneration = useRef(0)

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    if (!token || !supplierId || !organizationId) {
      setTeam([])
      setInvitations([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const [teamResponse, invitationResponse] = await Promise.all([
        api.supplierWs.team(token),
        api.getOrganizationInvitations(organizationId),
      ])
      if (generation !== requestGeneration.current) return
      setTeam(rowsFrom<SupplierTeamMember>(teamResponse))
      setInvitations(rowsFrom<SupplierInvitation>(invitationResponse))
    } catch (error) {
      if (generation !== requestGeneration.current) return
      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить команду компании')
    } finally {
      if (generation === requestGeneration.current) setLoading(false)
    }
  }, [organizationId, supplierId, token])

  useEffect(() => {
    void load()
    return () => { requestGeneration.current += 1 }
  }, [load])

  const inviteManager = async () => {
    if (!organizationId || savingInvite) return
    setSavingInvite(true)
    try {
      const invitation = await api.createOrganizationInvitation({
        organizationId,
        role: 'manager',
        email: email.trim() || undefined,
      })
      setEmail('')
      toast.success('Приглашение создано. Передайте сотруднику код для входа.')
      await load()
      if (invitation?.code) setCopiedCode(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось создать приглашение')
    } finally {
      setSavingInvite(false)
    }
  }

  const revokeInvitation = async (invitation: SupplierInvitation) => {
    if (busyInvitationId) return
    setBusyInvitationId(invitation.id)
    try {
      await api.revokeOrganizationInvitation(invitation.id)
      setInvitations((current) => current.filter((item) => item.id !== invitation.id))
      toast.success('Приглашение отозвано')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отозвать приглашение')
    } finally {
      setBusyInvitationId(null)
    }
  }

  const removeMember = async (member: SupplierTeamMember) => {
    const memberName = [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.email || 'сотрудника'
    if (member.role === 'owner' || busyMemberId) return
    if (!window.confirm(`Удалить ${memberName} из компании? Доступ к кабинету будет отозван.`)) return

    setBusyMemberId(member.id)
    try {
      await api.supplierWs.removeMember(token, member.id)
      setTeam((current) => current.filter((item) => item.id !== member.id))
      toast.success('Сотрудник удалён из компании')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить сотрудника')
    } finally {
      setBusyMemberId(null)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      toast.success('Код приглашения скопирован')
    } catch {
      toast.error('Не удалось скопировать код')
    }
  }

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium text-txt-primary">Не удалось определить компанию</p>
          <p className="mt-1 text-sm text-txt-muted">Переключитесь на нужную компанию и откройте управление командой снова.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
              <Users size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-txt-primary">Команда компании</h2>
              <p className="mt-1 text-sm text-txt-muted">Добавляйте сотрудников и управляйте доступом к кабинету поставщика. Владелец компании остаётся защищённым от случайного удаления.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Input
              label="Email сотрудника"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="manager@company.kz"
              inputMode="email"
            />
            <Button className="min-h-11" onClick={() => void inviteManager()} loading={savingInvite} disabled={savingInvite}>
              <UserPlus size={15} /> Пригласить менеджера
            </Button>
          </div>
          <p className="text-xs text-txt-muted">Сотрудник присоединится по одноразовому коду. Укажите email, чтобы ограничить приглашение конкретным адресом.</p>
        </CardContent>
      </Card>

      {loadError && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-error">{loadError}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Сотрудники</h3>
              <p className="mt-1 text-xs text-txt-muted">{team.length} в составе компании</p>
            </div>
            <Button size="sm" variant="secondary" className="min-h-10" onClick={() => void load()} disabled={loading}>Обновить</Button>
          </div>
          {loading ? <ListSkeleton count={3} /> : team.length === 0 ? (
            <div className="rounded-xl border border-dashed border-bdr-subtle px-4 py-8 text-center">
              <Users size={24} className="mx-auto text-txt-muted" />
              <p className="mt-2 text-sm font-medium text-txt-primary">Команда пока не сформирована</p>
              <p className="mt-1 text-xs text-txt-muted">Создайте приглашение, чтобы добавить первого сотрудника.</p>
            </div>
          ) : (
            <ul className="divide-y divide-bdr-subtle">
              {team.map((member) => {
                const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.email || 'Сотрудник'
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-txt-secondary">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-txt-primary">{name}</p>
                      {member.email && <p className="break-all text-xs text-txt-muted">{member.email}</p>}
                    </div>
                    <Badge variant={member.role === 'owner' ? 'gold' : 'outline'}>{roleTitle(member.role)}</Badge>
                    {member.role !== 'owner' && (
                      <Button
                        size="xs"
                        variant="danger"
                        className="min-h-10"
                        loading={busyMemberId === member.id}
                        disabled={Boolean(busyMemberId)}
                        onClick={() => void removeMember(member)}
                        aria-label="Удалить сотрудника"
                      >
                        <Trash2 size={14} /> Удалить
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Mail size={16} className="text-txt-muted" />
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Приглашения</h3>
              <p className="mt-1 text-xs text-txt-muted">Активные коды для новых сотрудников</p>
            </div>
          </div>
          {loading ? <ListSkeleton count={2} /> : invitations.length === 0 ? (
            <p className="rounded-xl bg-surface-1 px-4 py-6 text-center text-sm text-txt-muted">Нет активных приглашений</p>
          ) : (
            <ul className="divide-y divide-bdr-subtle">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-sm tracking-wider text-txt-primary">{invitation.code}</code>
                    <p className="mt-2 text-xs text-txt-muted">
                      {invitation.email || 'Доступно по коду'} · {invitation.expiresAt ? `до ${new Date(invitation.expiresAt).toLocaleDateString('ru-RU')}` : 'без срока'}
                    </p>
                  </div>
                  <Badge variant="outline">Менеджер</Badge>
                  <Button size="xs" variant="secondary" className="min-h-10" onClick={() => void copyCode(invitation.code)}>
                    {copiedCode === invitation.code ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCode === invitation.code ? 'Скопировано' : 'Копировать'}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="min-h-10"
                    loading={busyInvitationId === invitation.id}
                    disabled={Boolean(busyInvitationId)}
                    onClick={() => void revokeInvitation(invitation)}
                    aria-label="Отозвать приглашение"
                  >
                    <X size={14} /> Отозвать
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
