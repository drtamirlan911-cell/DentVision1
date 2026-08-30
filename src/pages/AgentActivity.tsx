import React, { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Bot, Clock, RefreshCw, ShieldAlert, User as UserIcon } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useAITimeline, useAITimelineStats, type TimelineEvent } from '@/hooks/useAITimeline'
import type { Clinic, User, RoleInfo } from '@/types'

const STATUS_LABEL: Record<string, { l: string; v: 'success' | 'warning' | 'error' }> = {
  ok: { l: 'Выполнено', v: 'success' },
  tool_error: { l: 'Ошибка', v: 'warning' },
  denied: { l: 'Отказано', v: 'error' },
}

const DENY_REASON_LABEL: Record<string, string> = {
  NO_TOOL: 'Инструмент не найден',
  NOT_ON_SURFACE: 'Недоступно на этой поверхности',
  NOT_ALLOWED: 'Нет прав',
  NO_PERMISSION: 'Нет разрешения',
  NO_CLINIC: 'Нет активной клиники',
  CLINIC_MISMATCH: 'Другая клиника',
  OUT_OF_PATIENT_SCOPE: 'Вне зоны доступа к пациенту',
  EXEC_ERROR: 'Ошибка выполнения',
}

function statusInfo(status: string) {
  return STATUS_LABEL[status] || { l: status, v: 'error' as const }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AgentActivity() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const timeline = useAITimeline({
    clinicId: clinic?.id,
    limit: 200,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const stats = useAITimelineStats(clinic?.id)

  const filteredEntries = useMemo(() => {
    const entries: TimelineEvent[] = timeline.data?.entries || []
    if (!searchQuery) return entries
    const q = searchQuery.toLowerCase()
    return entries.filter((e) =>
      e.type?.toLowerCase().includes(q) ||
      e.agentId?.toLowerCase().includes(q) ||
      e.actorRole?.toLowerCase().includes(q) ||
      e.userId?.toLowerCase().includes(q),
    )
  }, [timeline.data, searchQuery])

  return (
    <div className="fade-in max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        title="Центр активности ИИ"
        subtitle="Каждый вызов инструмента ассистентом — выполненный или отклонённый, с причиной"
        icon={<Bot size={24} className="text-dv-gold" />}
        actions={
          <Button className="min-h-11" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => timeline.refetch()}>
            Обновить
          </Button>
        }
      />

      {stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Всего', value: stats.data.totalEvents },
            { label: 'Сегодня', value: stats.data.todayEvents },
            { label: 'Успешно', value: stats.data.successEvents },
            { label: 'Отклонено/ошибки', value: stats.data.failedEvents },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-2xl font-bold text-txt-primary">{s.value}</p>
              <p className="text-xs text-txt-muted mt-1">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <input
            placeholder="Поиск по инструменту, агенту, роли, пользователю..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-11 w-full"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="dv-select w-full md:w-56 min-h-11">
          <option value="all">Все статусы</option>
          <option value="ok">Выполнено</option>
          <option value="tool_error">Ошибка</option>
          <option value="denied">Отказано</option>
        </select>
      </div>

      <Card>
        {timeline.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={<Bot size={48} />}
            title="Пока нет активности"
            description="Здесь появится каждый вызов ИИ-инструмента, как только ассистент начнёт работать"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Время</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Пользователь</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Инструмент</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Роль</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Длительность</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => {
                  const info = statusInfo(e.status)
                  const reason = e.status !== 'ok' && e.error ? (DENY_REASON_LABEL[e.error] || e.error) : null
                  return (
                    <tr key={e.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-txt-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-txt-ghost" />
                          {formatTime(e.timestamp)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <UserIcon size={12} className="text-txt-ghost" />
                          <span className="text-xs text-txt-primary font-mono truncate max-w-[140px]">{e.userId || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-txt-secondary font-mono">{e.type}</td>
                      <td className="px-4 py-3 text-xs text-txt-secondary">{e.actorRole || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={info.v} size="xs">{info.l}</Badge>
                          {reason && (
                            <span className="inline-flex items-center gap-1 text-2xs text-txt-ghost">
                              <ShieldAlert size={10} />
                              {reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-txt-ghost">{e.durationMs != null ? `${e.durationMs} мс` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-center text-xs text-txt-ghost">
        Показано {filteredEntries.length} из {timeline.data?.total ?? 0} записей
      </div>
    </div>
  )
}
