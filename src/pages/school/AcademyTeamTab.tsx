import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, GraduationCap, Mail, Trash2, UserPlus, Users, X } from 'lucide-react'

import * as api from '@/utils/api'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Input } from '@/components/ui/ds/Input'
import { ListSkeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import { ConfirmModal } from '@/components/ui/ds/Modal'

interface AcademyLecturer {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  email?: string
  level?: string
  speciality?: string | null
  courseCount: number
}

interface AcademyInvitation {
  id: string
  code: string
  role: string
  email?: string | null
  expiresAt?: string | null
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

function lecturerLevelLabel(level?: string) {
  switch (String(level || '').toLowerCase()) {
    case 'expert': return 'Подтверждённый эксперт'
    case 'advanced': return 'Продвинутый уровень'
    case 'verified': return 'Проверен'
    case 'new': return 'Ожидает проверки'
    default: return level || 'Уровень не указан'
  }
}

export default function AcademyTeamTab({ organizationId }: { organizationId: string }) {
  const toast = useToast()
  const [lecturers, setLecturers] = useState<AcademyLecturer[]>([])
  const [invitations, setInvitations] = useState<AcademyInvitation[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [lecturerToRemove, setLecturerToRemove] = useState<AcademyLecturer | null>(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const current = ++generation.current
    if (!organizationId) {
      setLecturers([])
      setInvitations([])
      setLoading(false)
      setError('Не удалось определить активную академию.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [lecturerRows, invitationRows] = await Promise.all([
        api.getManagedSchoolLecturers(),
        api.getOrganizationInvitations(organizationId),
      ])
      if (generation.current !== current) return
      setLecturers(rowsFrom<AcademyLecturer>(lecturerRows))
      setInvitations(rowsFrom<AcademyInvitation>(invitationRows))
    } catch (cause) {
      if (generation.current !== current) return
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить команду академии')
    } finally {
      if (generation.current === current) setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    void load()
    return () => { generation.current += 1 }
  }, [load])

  const inviteLecturer = async () => {
    if (!organizationId || saving) return
    setSaving(true)
    try {
      const response = await api.createOrganizationInvitation({
        organizationId,
        role: 'lecturer',
        email: email.trim() || undefined,
      })
      setEmail('')
      const created = (response?.data || response) as AcademyInvitation
      if (created?.id && created?.code) {
        setInvitations((current) => [created, ...current.filter((row) => row.id !== created.id)])
      } else {
        await load()
      }
      toast.success('Приглашение преподавателю создано')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Не удалось создать приглашение')
    } finally {
      setSaving(false)
    }
  }

  const revokeInvite = async (invitation: AcademyInvitation) => {
    if (busyId) return
    setBusyId(invitation.id)
    try {
      await api.revokeOrganizationInvitation(invitation.id)
      setInvitations((current) => current.filter((row) => row.id !== invitation.id))
      toast.success('Приглашение отозвано')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Не удалось отозвать приглашение')
    } finally {
      setBusyId(null)
    }
  }

  const removeLecturer = async (lecturer: AcademyLecturer) => {
    if (busyId) return
    if (lecturer.courseCount > 0) {
      toast.error('Сначала переназначьте курсы преподавателя. Система сохраняет учебную историю и действующие продукты.')
      return
    }

    setBusyId(lecturer.id)
    try {
      await api.removeManagedSchoolLecturer(lecturer.id)
      setLecturers((current) => current.filter((row) => row.id !== lecturer.id))
      toast.success('Преподаватель удалён из команды академии')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Не удалось удалить преподавателя')
    } finally {
      setBusyId(null)
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
              <GraduationCap size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-txt-primary">Команда академии</h2>
              <p className="mt-1 text-sm text-txt-muted">Добавляйте преподавателей в академию, контролируйте статус проверки и распределение курсов.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Input
              label="Email преподавателя (необязательно)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="lecturer@academy.kz"
            />
            <Button className="min-h-11" loading={saving} disabled={saving} onClick={() => void inviteLecturer()}>
              <UserPlus size={15} /> Пригласить преподавателя
            </Button>
          </div>
          <p className="text-xs text-txt-muted">Приглашение одноразовое. Новый преподаватель получит собственный кабинет лектора; проверка квалификации и доступ к выплатам остаются отдельным процессом.</p>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-error">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>Повторить</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Преподаватели</h3>
              <p className="mt-1 text-xs text-txt-muted">{lecturers.length} в команде</p>
            </div>
            <Button size="sm" variant="secondary" className="min-h-10" disabled={loading} onClick={() => void load()}>Обновить</Button>
          </div>
          {loading ? <ListSkeleton count={3} /> : lecturers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-bdr-subtle px-4 py-8 text-center">
              <Users size={24} className="mx-auto text-txt-muted" />
              <p className="mt-2 text-sm font-medium text-txt-primary">Команда преподавателей пока пуста</p>
              <p className="mt-1 text-xs text-txt-muted">Создайте приглашение, чтобы подключить первого преподавателя.</p>
            </div>
          ) : (
            <ul className="divide-y divide-bdr-subtle">
              {lecturers.map((lecturer) => {
                const name = [lecturer.firstName, lecturer.lastName].filter(Boolean).join(' ').trim() || lecturer.email || 'Преподаватель'
                return (
                  <li key={lecturer.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-txt-secondary">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-txt-primary">{name}</p>
                      {lecturer.email && <p className="break-all text-xs text-txt-muted">{lecturer.email}</p>}
                      <p className="mt-1 text-xs text-txt-muted">{lecturer.courseCount} курсов{lecturer.speciality ? ` · ${lecturer.speciality}` : ''}</p>
                    </div>
                    <Badge variant={lecturer.level === 'new' ? 'warning' : 'outline'}>{lecturerLevelLabel(lecturer.level)}</Badge>
                    <Button
                      size="xs"
                      variant="danger"
                      className="min-h-10"
                      loading={busyId === lecturer.id}
                      disabled={Boolean(busyId) || lecturer.courseCount > 0}
                      onClick={() => setLecturerToRemove(lecturer)}
                      aria-label="Удалить преподавателя"
                      title={lecturer.courseCount > 0 ? 'Сначала переназначьте курсы преподавателя' : 'Убрать из команды'}
                    >
                      <Trash2 size={14} /> Убрать
                    </Button>
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
              <p className="mt-1 text-xs text-txt-muted">Ожидающие принятия коды</p>
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
                    <p className="mt-2 text-xs text-txt-muted">{invitation.email || 'Доступно по коду'} · {invitation.expiresAt ? `до ${new Date(invitation.expiresAt).toLocaleDateString('ru-RU')}` : 'без срока'}</p>
                  </div>
                  <Badge variant="outline">Преподаватель</Badge>
                  <Button size="xs" variant="secondary" className="min-h-10" onClick={() => void copyCode(invitation.code)}>
                    {copiedCode === invitation.code ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCode === invitation.code ? 'Скопировано' : 'Копировать'}
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="min-h-10"
                    loading={busyId === invitation.id}
                    disabled={Boolean(busyId)}
                    onClick={() => void revokeInvite(invitation)}
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
      <ConfirmModal
        open={Boolean(lecturerToRemove)}
        onClose={() => setLecturerToRemove(null)}
        onConfirm={() => {
          if (lecturerToRemove) void removeLecturer(lecturerToRemove)
          setLecturerToRemove(null)
        }}
        title="Убрать преподавателя из академии?"
        message={`${lecturerToRemove ? [lecturerToRemove.firstName, lecturerToRemove.lastName].filter(Boolean).join(' ').trim() || lecturerToRemove.email || 'Преподаватель' : 'Преподаватель'} потеряет доступ к этой академии. Его профиль и исторические записи сохранятся.`}
        confirmLabel="Да, убрать преподавателя"
        variant="danger"
      />
    </div>
  )
}
