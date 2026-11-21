import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { QueryError } from '@/components/ui/ds/QueryError'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import type { TabProps } from './types'

type Draft = { name: string; kind: string; manufacturer: string; model: string; serialNumber: string; room: string; aeTitle: string; nextMaintenanceAt: string }
const EMPTY: Draft = { name: '', kind: 'CBCT', manufacturer: '', model: '', serialNumber: '', room: '', aeTitle: '', nextMaintenanceAt: '' }
const TYPES: Record<string, string> = { CBCT: 'КЛКТ', OPG: 'ОПТГ', TRG: 'ТРГ', INTRAORAL: 'Внутриротовой рентген', PANORAMIC: 'Панорамный аппарат', CT: 'КТ', MRI: 'МРТ', OTHER: 'Другое' }
const STATES: Record<string, string> = { active: 'Работает', maintenance: 'Обслуживание', out_of_service: 'Неисправно' }

export function ModalitiesTab({ orgId }: TabProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const query = useQuery({
    queryKey: ['diagnostics', 'modalities', orgId],
    queryFn: () => api.getDiagnosticModalities(orgId),
    enabled: !!orgId,
  })
  const items = query.data?.data || query.data || []
  const createMutation = useMutation({
    mutationFn: () => api.createDiagnosticModality(orgId, { ...draft, nextMaintenanceAt: draft.nextMaintenanceAt || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'modalities', orgId] })
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist', orgId] })
      setDraft(EMPTY); setOpen(false); toast.success('Оборудование добавлено')
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось добавить оборудование'),
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateDiagnosticModality(orgId, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'modalities', orgId] })
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-worklist', orgId] })
      toast.success('Статус оборудования обновлён')
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось обновить статус'),
  })
  if (query.isError) return <QueryError what="реестр оборудования" onRetry={() => query.refetch()} />
  const inputClass = 'min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary'
  const setField = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }))

  return (
    <div className="space-y-4">
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-txt-primary"><Wrench size={16} /> Оборудование и кабинеты</h3>
            <p className="mt-1 text-xs text-txt-muted">Аппараты, помещения, серийные номера, DICOM AE Title и дата обслуживания.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setOpen((value) => !value)}><Plus size={14} /> Добавить аппарат</Button>
        </div>
      </Card>

      {open && (
        <Card padding="md" className="space-y-3">
          <h4 className="text-sm font-semibold text-txt-primary">Новый аппарат</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-txt-secondary">Название
              <input className={inputClass} value={draft.name} onChange={(event) => setField('name', event.target.value)} placeholder="КЛКТ — кабинет 1" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Тип
              <select className={inputClass} value={draft.kind} onChange={(event) => setField('kind', event.target.value)}>
                {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Производитель
              <input className={inputClass} value={draft.manufacturer} onChange={(event) => setField('manufacturer', event.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Модель
              <input className={inputClass} value={draft.model} onChange={(event) => setField('model', event.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Серийный номер
              <input className={inputClass} value={draft.serialNumber} onChange={(event) => setField('serialNumber', event.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Кабинет / помещение
              <input className={inputClass} value={draft.room} onChange={(event) => setField('room', event.target.value)} placeholder="Кабинет 2" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">DICOM AE Title
              <input className={inputClass} value={draft.aeTitle} maxLength={16} onChange={(event) => setField('aeTitle', event.target.value.toUpperCase())} />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Следующее обслуживание
              <input className={inputClass} type="date" value={draft.nextMaintenanceAt} onChange={(event) => setField('nextMaintenanceAt', event.target.value)} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setOpen(false); setDraft(EMPTY) }}>Отмена</Button>
            <Button variant="primary" loading={createMutation.isPending} disabled={draft.name.trim().length < 2} onClick={() => createMutation.mutate()}>Сохранить аппарат</Button>
          </div>
        </Card>
      )}

      {query.isLoading ? <Skeleton className="h-32" /> : items.length === 0 ? (
        <Card padding="lg"><p className="py-5 text-center text-sm text-txt-muted">Оборудование ещё не добавлено. Зарегистрируйте аппарат, чтобы назначать его на исследования.</p></Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item: any) => (
            <Card key={item.id} padding="md" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-txt-primary">{item.name}</h4>
                  <p className="mt-1 text-xs text-txt-muted">{TYPES[item.kind] || item.kind}{item.room ? ' · ' + item.room : ''}</p>
                </div>
                <Badge variant={item.status === 'active' ? 'success' : item.status === 'maintenance' ? 'warning' : 'danger'}>{STATES[item.status] || item.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-txt-muted">
                <span>Производитель: {item.manufacturer || '—'}</span>
                <span>Модель: {item.model || '—'}</span>
                <span>Серийный номер: {item.serialNumber || '—'}</span>
                <span>AE Title: {item.aeTitle || 'Не задан'}</span>
                <span>Обслуживание: {item.nextMaintenanceAt ? new Date(item.nextMaintenanceAt).toLocaleDateString('ru-RU') : 'Не запланировано'}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-txt-secondary">Статус:
                <select aria-label={'Статус аппарата ' + item.name} value={item.status} disabled={statusMutation.isPending}
                  onChange={(event) => statusMutation.mutate({ id: item.id, status: event.target.value })}
                  className="min-h-11 flex-1 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
                  <option value="active">Работает</option>
                  <option value="maintenance">Обслуживание</option>
                  <option value="out_of_service">Неисправно</option>
                </select>
              </label>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-txt-muted">Этот реестр не подключает PACS/DICOM-сеть и не хранит изображения. DICOMweb, архив и диагностический viewer остаются отдельным этапом интеграции.</p>
    </div>
  )
}

export default ModalitiesTab
