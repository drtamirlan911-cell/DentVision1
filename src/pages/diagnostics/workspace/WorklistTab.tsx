import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, RefreshCw, Search } from 'lucide-react'
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

export function WorklistTab({ orgId }: TabProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { activeWorkspace, user } = useAuth()
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const role = String(activeWorkspace?.roleKey || activeWorkspace?.role || user?.role || '').toLowerCase()
  const canAssignEquipment = user?.role === 'superadmin'
    || ['owner', 'admin', 'manager', 'director'].some((suffix) => role.endsWith(suffix))
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
  const rows = worklistQuery.data?.data?.items || worklistQuery.data?.items || []
  const modalities = modalitiesQuery.data?.data || modalitiesQuery.data || []
  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ru-RU')
    if (!term) return rows
    return rows.filter((row: any) =>
      [row.patientName, row.studyType, row.clinic?.name, row.modality?.name]
        .some((value) => String(value || '').toLocaleLowerCase('ru-RU').includes(term)),
    )
  }, [rows, search])
  const assignMutation = useMutation({
    mutationFn: ({ referralId, modalityId }: { referralId: string; modalityId: string | null }) =>
      api.assignDiagnosticModality(orgId, referralId, modalityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist', orgId] })
      toast.success('Оборудование назначено')
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось назначить оборудование'),
  })

  if (worklistQuery.isError) return <QueryError what="рабочую очередь диагностического центра" onRetry={() => worklistQuery.refetch()} />

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary"><ClipboardList size={16} /> Очередь исследований</h3>
            <p className="mt-1 text-xs text-txt-muted">Сначала экстренные и срочные исследования. ИИН, контакты и клинические заметки не выгружаются в эту очередь.</p>
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

      {worklistQuery.isLoading || modalitiesQuery.isLoading ? (
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
                <Badge variant={row.priority === 'EMERGENCY' ? 'error : row.priority === 'URGENT' ? 'warning' : 'outline'}>
                  {PRIORITY_LABEL[row.priority] || row.priority}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-txt-muted">
                <Badge variant="outline">{STATUS_LABEL[row.status] || row.status}</Badge>
                <span>{row.category}</span>
                <span>Файлов: {row._count?.files || 0}</span>
                {row.scheduledDate && <span>{new Date(row.scheduledDate).toLocaleDateString('ru-RU')} {row.scheduledTime || ''}</span>}
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
            </Card>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => { worklistQuery.refetch(); modalitiesQuery.refetch() }}><RefreshCw size={14} /> Обновить очередь</Button>
      </div>
    </div>
  )
}

export default WorklistTab
