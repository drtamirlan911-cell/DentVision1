import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ClipboardList, FileText, History, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { QueryError } from '@/components/ui/ds/QueryError'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import { useAuth } from '@/store/auth.store'
import * as api from '@/utils/api'
import type { TabProps } from './types'

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Новое направление', ACCEPTED: 'Принято', SCHEDULED: 'Запланировано',
  PATIENT_ARRIVED: 'Пациент прибыл', IN_PROGRESS: 'Исследование',
  COMPLETED: 'Завершено', REVIEWED: 'Проверено', DELIVERED: 'Передано врачу',
}
const PRIORITY_LABEL: Record<string, string> = {
  EMERGENCY: 'Экстренно', URGENT: 'Срочно', NORMAL: 'Обычный',
}
const MANAGER_SUFFIXES = ['owner', 'admin', 'manager', 'director']
const SCHEDULING_ROLES = ['diagnostic_operator', 'operator', 'reception', 'receptionist', 'registrar', 'center_reception']
const ACQUISITION_ROLES = [...SCHEDULING_ROLES, 'modality_technician', 'radiology_technician', 'radiologist']

function roleCanManage(role: string): boolean {
  return MANAGER_SUFFIXES.some((suffix) => role === suffix || role.endsWith('_' + suffix))
}
function normalizeLabel(value: unknown): string {
  return String(value || '').toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9]+/gi, '')
}
function resolvePrice(row: any, studies: any[]): number | undefined {
  const wanted = normalizeLabel(row.studyType)
  const byName = studies.filter((study) => {
    const available = normalizeLabel(study.name)
    return available && wanted && (available.includes(wanted) || wanted.includes(available))
  })
  const matches = byName.length
    ? byName
    : studies.filter((study) => String(study.category || '').toUpperCase() === String(row.category || '').toUpperCase())
  if (matches.length !== 1) return undefined
  const amount = Number(matches[0].price)
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function formatDate(value?: string | Date | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU')
}

export function WorklistTab({ orgId }: TabProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { activeWorkspace, user } = useAuth()
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [reportText, setReportText] = useState('')
  const [conclusion, setConclusion] = useState('')

  const role = String(activeWorkspace?.roleKey || activeWorkspace?.role || user?.role || '').toLowerCase()
  const canManage = user?.role === 'superadmin' || roleCanManage(role)
  const canSchedule = canManage || SCHEDULING_ROLES.includes(role)
  const canAcquire = canManage || ACQUISITION_ROLES.includes(role)
  const canSign = role === 'radiologist' || role.endsWith('_radiologist')
  const canRelease = canManage || canSign
  const canAssignEquipment = canManage

  const worklistQuery = useQuery({
    queryKey: ['diagnostics', 'center-worklist', orgId, status],
    queryFn: () => api.getDiagnosticCenterWorklist(orgId, { status: status === 'active' ? undefined : status, limit: 100 }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  })
  const modalitiesQuery = useQuery({
    queryKey: ['diagnostics', 'modalities', orgId],
    queryFn: () => api.getDiagnosticModalities(orgId),
    enabled: !!orgId,
  })
  const studiesQuery = useQuery({
    queryKey: ['diagnostics', 'studies', orgId],
    queryFn: () => api.getDiagnosticStudies(orgId),
    enabled: !!orgId,
  })
  const detailQuery = useQuery({
    queryKey: ['diagnostics', 'center-worklist-detail', orgId, selectedReferralId],
    queryFn: () => api.getDiagnosticCenterWorklistReferralDetail(orgId, selectedReferralId as string),
    enabled: Boolean(orgId && selectedReferralId),
  })

  const rows = worklistQuery.data?.data?.items || worklistQuery.data?.items || []
  const modalities = modalitiesQuery.data?.data || modalitiesQuery.data || []
  const studies = studiesQuery.data?.data || studiesQuery.data || []
  const detail = detailQuery.data?.data || detailQuery.data || null
  const referral = detail?.referral || null
  const events = Array.isArray(detail?.events) ? detail.events : []

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ru-RU')
    if (!term) return rows
    return rows.filter((row: any) =>
      [row.patientName, row.studyType, row.clinic?.name, row.modality?.name]
        .some((value) => String(value || '').toLocaleLowerCase('ru-RU').includes(term)),
    )
  }, [rows, search])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist', orgId] })
    if (selectedReferralId) queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist-detail', orgId, selectedReferralId] })
    queryClient.invalidateQueries({ queryKey: ['diagnostics', 'dashboard'] })
  }

  const assignMutation = useMutation({
    mutationFn: ({ referralId, modalityId }: { referralId: string; modalityId: string | null }) =>
      api.assignDiagnosticModality(orgId, referralId, modalityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist', orgId] })
      if (selectedReferralId) queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist-detail', orgId, selectedReferralId] })
      toast.success('Оборудование назначено')
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось назначить оборудование'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ referralId, nextStatus, extra }: { referralId: string; nextStatus: string; extra?: Record<string, unknown> }) =>
      api.changeDiagnosticReferralStatus(referralId, nextStatus, undefined, extra),
    onSuccess: () => {
      toast.success('Этап исследования обновлён')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось изменить этап исследования'),
  })

  const signMutation = useMutation({
    mutationFn: () => api.signDiagnosticResult(String(selectedReferralId), reportText.trim(), conclusion.trim() || undefined),
    onSuccess: () => {
      toast.success('Заключение подписано')
      setReportText('')
      setConclusion('')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось подписать заключение'),
  })

  const selectedRow = rows.find((row: any) => row.id === selectedReferralId)
  const selectedPrice = selectedRow ? resolvePrice(selectedRow, studies) : undefined
  const resultSigned = Boolean(referral?.result?.signedAt)

  const openDetails = (id: string) => {
    setSelectedReferralId((current) => current === id ? null : id)
    setScheduledDate('')
    setScheduledTime('')
    setReportText('')
    setConclusion('')
  }

  const transition = (nextStatus: string, extra?: Record<string, unknown>) => {
    if (!selectedReferralId) return
    statusMutation.mutate({ referralId: selectedReferralId, nextStatus, extra })
  }

  if (worklistQuery.isError) return <QueryError what="рабочую очередь диагностического центра" onRetry={() => worklistQuery.refetch()} />

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary"><ClipboardList size={16} /> Очередь исследований</h3>
            <p className="mt-1 text-xs text-txt-muted">Сначала экстренные и срочные исследования. ИИН и контакты доступны только в карточке авторизованного рабочего направления.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block min-w-0 sm:min-w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input aria-label="Поиск по очереди" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Пациент, исследование, клиника"
                className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 py-2 pl-9 pr-3 text-sm text-txt-primary" />
            </label>
            <select aria-label="Фильтр статуса очереди" value={status} onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
              <option value="active">Активные</option>
              <option value="SENT">Новые</option>
              <option value="ACCEPTED">Приняты</option>
              <option value="SCHEDULED">Запланированы</option>
              <option value="PATIENT_ARRIVED">Пациент прибыл</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="COMPLETED">Завершены</option>
              <option value="REVIEWED">Проверены</option>
              <option value="DELIVERED">Переданы врачу</option>
            </select>
          </div>
        </div>
      </Card>

      {worklistQuery.isLoading || modalitiesQuery.isLoading || studiesQuery.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : modalitiesQuery.isError ? (
        <QueryError what="оборудование диагностического центра" onRetry={() => modalitiesQuery.refetch()} />
      ) : visibleRows.length === 0 ? (
        <Card padding="lg"><div className="py-6 text-center">
          <p className="text-sm font-medium text-txt-primary">В этой очереди пока нет исследований</p>
          <p className="mt-1 text-xs text-txt-muted">Новые направления появятся здесь после отправки клиникой.</p>
        </div></Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleRows.map((row: any) => (
            <Card key={row.id} padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-txt-primary">{row.patientName || 'Пациент'}</p>
                  <p className="mt-1 text-xs text-txt-muted">{row.clinic?.name || 'Клиника'} · {row.studyType}</p>
                </div>
                <Badge variant={row.priority === 'EMERGENCY' ? 'error' : row.priority === 'URGENT' ? 'warning' : 'outline'}>
                  {PRIORITY_LABEL[row.priority] || row.priority}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-txt-muted">
                <Badge variant="outline">{STATUS_LABEL[row.status] || row.status}</Badge>
                <span>{row.category}</span>
                <span>Файлов: {row._count?.files || 0}</span>
                {row.scheduledDate && <span>{formatDate(row.scheduledDate)} {row.scheduledTime || ''}</span>}
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs font-medium text-txt-secondary">Оборудование и кабинет</p>
                {canAssignEquipment ? (
                  <select aria-label={'Оборудование для ' + row.patientName} value={row.modalityId || ''}
                    disabled={assignMutation.isPending}
                    onChange={(event) => assignMutation.mutate({ referralId: row.id, modalityId: event.target.value || null })}
                    className="mt-2 min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
                    <option value="">Не назначено</option>
                    {modalities.filter((item: any) => item.status === 'active').map((item: any) => (
                      <option key={item.id} value={item.id}>{item.name}{item.room ? ' · ' + item.room : ''}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-sm text-txt-primary">{row.modality?.name || 'Не назначено'}{row.modality?.room ? ' · ' + row.modality.room : ''}</p>
                )}
              </div>
              <Button size="sm" variant={selectedReferralId === row.id ? 'secondary' : 'ghost'} className="w-full" onClick={() => openDetails(row.id)}>
                <FileText size={14} /> {selectedReferralId === row.id ? 'Скрыть карточку исследования' : 'Открыть карточку исследования'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {selectedReferralId && (
        <Card padding="lg" className="space-y-4">
          {detailQuery.isLoading && <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-32" /></div>}
          {detailQuery.isError && <QueryError what="карточку исследования" onRetry={() => detailQuery.refetch()} />}
          {referral && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-txt-primary">Карточка исследования</p>
                  <p className="mt-1 text-xs text-txt-muted">{referral.clinic?.name || 'Клиника'} · {referral.studyType} · {formatDate(referral.createdAt)}</p>
                </div>
                <Badge variant={referral.status === 'DELIVERED' ? 'success' : referral.priority === 'EMERGENCY' ? 'error' : 'outline'}>
                  {STATUS_LABEL[referral.status] || referral.status}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-surface-2 p-3">
                  <p className="text-[11px] text-txt-muted">Пациент</p>
                  <p className="mt-1 text-sm font-semibold text-txt-primary">{referral.patientName || '—'}</p>
                  <p className="mt-1 text-xs text-txt-secondary">{formatDate(referral.patientBirth)} · {referral.patientGender || 'Пол не указан'}</p>
                  <p className="mt-1 text-xs text-txt-secondary">{referral.patientPhone || 'Телефон не указан'}</p>
                  {referral.patientIin && <p className="mt-1 text-[11px] text-txt-muted">ИИН: ••••••••{String(referral.patientIin).slice(-4)}</p>}
                </div>
                <div className="rounded-lg bg-surface-2 p-3">
                  <p className="text-[11px] text-txt-muted">Исследование</p>
                  <p className="mt-1 text-sm font-semibold text-txt-primary">{referral.studyType}</p>
                  <p className="mt-1 text-xs text-txt-secondary">{referral.category} · {referral.priority === 'EMERGENCY' ? 'Экстренно' : referral.priority === 'URGENT' ? 'Срочно' : 'Обычный приоритет'}</p>
                  <p className="mt-1 text-xs text-txt-secondary">Оборудование: {referral.modality?.name || 'Не назначено'}</p>
                </div>
                <div className="rounded-lg bg-surface-2 p-3">
                  <p className="text-[11px] text-txt-muted">Запись</p>
                  <p className="mt-1 text-sm font-semibold text-txt-primary">{formatDate(referral.scheduledDate)} {referral.scheduledTime || ''}</p>
                  <p className="mt-1 text-xs text-txt-secondary">Стоимость: {referral.cost != null ? Number(referral.cost).toLocaleString('ru-RU') + ' ₸' : 'Не определена'}</p>
                  <p className="mt-1 text-xs text-txt-secondary">Направляющий врач: {referral.doctorName || referral.doctor?.firstName || '—'}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-txt-primary">Клинический запрос</p>
                  <div className="rounded-lg border border-bdr-subtle p-3 text-xs text-txt-secondary">
                    <p><span className="font-medium text-txt-primary">Жалобы:</span> {referral.complaints || 'Не указаны'}</p>
                    <p className="mt-2"><span className="font-medium text-txt-primary">Предварительный диагноз:</span> {referral.preliminaryDx || 'Не указан'}</p>
                    <p className="mt-2"><span className="font-medium text-txt-primary">Цель:</span> {referral.studyGoal || 'Не указана'}</p>
                    <p className="mt-2"><span className="font-medium text-txt-primary">Аллергии:</span> {referral.allergies || 'Не указаны'}</p>
                    {referral.specialNotes && <p className="mt-2"><span className="font-medium text-txt-primary">Особые отметки:</span> {referral.specialNotes}</p>}
                    {referral.anatomicalSites && <p className="mt-2"><span className="font-medium text-txt-primary">Область исследования:</span> {JSON.stringify(referral.anatomicalSites)}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold text-txt-primary"><FileText size={14} /> Материалы и заключение</p>
                  <div className="rounded-lg border border-bdr-subtle p-3">
                    {!!referral.files?.length ? referral.files.map((file: any) => (
                      <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="mb-2 flex min-h-9 items-center justify-between gap-2 text-xs text-accent underline">
                        <span className="truncate">{file.fileName || 'Файл исследования'}</span><span>{file.fileType || 'Файл'}</span>
                      </a>
                    )) : <p className="text-xs text-txt-muted">Материалы ещё не приложены клиникой.</p>}
                    {referral.result?.reportText && <div className="mt-3 border-t border-bdr-subtle pt-3">
                      <div className="flex items-center gap-2"><ShieldCheck size={14} /><p className="text-xs font-semibold text-txt-primary">Заключение</p></div>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-txt-secondary">{referral.result.reportText}</p>
                      {referral.result.conclusion && <p className="mt-2 text-xs font-semibold text-txt-primary">{referral.result.conclusion}</p>}
                      <p className="mt-2 text-[11px] text-txt-muted">{referral.result.signedAt ? 'Подписано ' + new Date(referral.result.signedAt).toLocaleString('ru-RU') : 'Черновик · не подписано'}</p>
                    </div>}
                  </div>
                </div>
              </div>

              {canManage && referral.status === 'SENT' && (
                <div className="rounded-xl border border-bdr-subtle bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-txt-primary">Принять направление</p>
                  <p className="mt-1 text-xs text-txt-muted">Стоимость будет взята из действующего прайс-листа центра и зафиксирована при принятии.</p>
                  <Button className="mt-3 w-full" size="sm" variant="primary" loading={statusMutation.isPending}
                    disabled={statusMutation.isPending || !selectedPrice}
                    onClick={() => transition('ACCEPTED')}>
                    {selectedPrice ? 'Принять · ' + selectedPrice.toLocaleString('ru-RU') + ' ₸' : 'Добавьте услугу и цену в прайс-лист'}
                  </Button>
                </div>
              )}

              {canSchedule && referral.status === 'ACCEPTED' && (
                <div className="rounded-xl border border-bdr-subtle bg-surface-2 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-txt-primary"><CalendarClock size={14} /> Запланировать исследование</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-txt-secondary">Дата
                      <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
                    </label>
                    <label className="space-y-1 text-xs text-txt-secondary">Время
                      <input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
                    </label>
                  </div>
                  <Button className="mt-3 w-full" size="sm" variant="primary" loading={statusMutation.isPending}
                    disabled={statusMutation.isPending || !scheduledDate || !scheduledTime}
                    onClick={() => transition('SCHEDULED', { scheduledDate, scheduledTime })}>Подтвердить запись</Button>
                </div>
              )}

              {canSchedule && referral.status === 'SCHEDULED' && (
                <Button className="w-full" size="sm" variant="primary" loading={statusMutation.isPending}
                  disabled={statusMutation.isPending} onClick={() => transition('PATIENT_ARRIVED')}>Отметить прибытие пациента</Button>
              )}

              {canAcquire && referral.status === 'PATIENT_ARRIVED' && (
                <Button className="w-full" size="sm" variant="primary" loading={statusMutation.isPending}
                  disabled={statusMutation.isPending} onClick={() => transition('IN_PROGRESS')}>Начать исследование</Button>
              )}

              {canSign && referral.status === 'IN_PROGRESS' && !resultSigned && (
                <div className="space-y-3 rounded-xl border border-bdr-subtle bg-surface-2 p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-txt-primary"><ShieldCheck size={14} /> Подписание заключения рентгенологом</p>
                  <textarea value={reportText} onChange={(event) => setReportText(event.target.value)} rows={5} maxLength={20000}
                    placeholder="Описание исследования и выявленные изменения" className="w-full rounded-lg border border-bdr-subtle bg-surface-1 p-3 text-xs text-txt-primary" />
                  <textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} rows={2} maxLength={5000}
                    placeholder="Заключение" className="w-full rounded-lg border border-bdr-subtle bg-surface-1 p-3 text-xs text-txt-primary" />
                  <Button className="w-full" size="sm" variant="primary" loading={signMutation.isPending}
                    disabled={signMutation.isPending || reportText.trim().length < 20 || conclusion.trim().length < 5}
                    onClick={() => signMutation.mutate()}>Подписать заключение и завершить исследование</Button>
                </div>
              )}

              {canRelease && referral.status === 'COMPLETED' && resultSigned && (
                <Button className="w-full" size="sm" variant="primary" loading={statusMutation.isPending}
                  disabled={statusMutation.isPending} onClick={() => transition('DELIVERED')}>Передать подписанное заключение клинике</Button>
              )}

              {referral.status === 'IN_PROGRESS' && !canSign && (
                <p className="rounded-lg bg-surface-2 p-3 text-xs text-txt-muted">Исследование выполняется. Подписать заключение может только сотрудник с ролью рентгенолога.</p>
              )}

              <div className="space-y-2 border-t border-bdr-subtle pt-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-txt-primary"><History size={14} /> История направления</p>
                {events.length ? events.map((event: any) => (
                  <div key={event.id} className="border-l-2 border-bdr-subtle pl-3">
                    <p className="text-xs font-medium text-txt-primary">{event.action}</p>
                    {event.details?.fromStatus && <p className="mt-1 text-xs text-txt-secondary">{event.details.fromStatus} → {event.details.toStatus}</p>}
                    <p className="mt-1 text-[11px] text-txt-muted">{event.userName || 'Сотрудник'} · {new Date(event.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                )) : <p className="text-xs text-txt-muted">Аудит-события по направлению пока не найдены.</p>}
              </div>
              {!!referral.comments?.length && (
                <div className="border-t border-bdr-subtle pt-3">
                  <p className="text-xs font-semibold text-txt-primary">Комментарии</p>
                  {referral.comments.map((comment: any) => (
                    <p key={comment.id} className="mt-2 text-xs text-txt-secondary">{comment.author?.firstName || 'Сотрудник'}: {comment.text}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => { worklistQuery.refetch(); modalitiesQuery.refetch(); studiesQuery.refetch(); if (selectedReferralId) detailQuery.refetch() }}><RefreshCw size={14} /> Обновить очередь</Button>
      </div>
    </div>
  )
}

export default WorklistTab
