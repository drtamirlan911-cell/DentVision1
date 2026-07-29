import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Bot,
  CheckCircle,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/ds/Card'

// ─── Types ───

export interface TimelineEvent {
  id: string
  type: string
  source: string
  timestamp: string | Date
  clinicId: string
  userId?: string
  payload?: Record<string, unknown>
}

export interface TimelineAction {
  action: string
  agent: string
  success: boolean
  message?: string
  durationMs?: number
  timelineEntry?: {
    action: string
    result: string
  }
}

export interface TimelineEntry {
  id: string
  event: TimelineEvent
  rules: Array<{
    id: string
    name: string
    event: string
    priority: string
  }>
  results: TimelineAction[]
  durationMs: number
  processedAt: Date
}

interface AITimelineProps {
  entries: TimelineEntry[]
  maxVisible?: number
  onRefresh?: () => void
  loading?: boolean
}

// ─── Helpers ───

const EVENT_LABELS: Record<string, string> = {
  PatientCreated: 'Новый пациент',
  PatientArrived: 'Пациент пришёл',
  PatientNoShow: 'Неявка',
  AppointmentBooked: 'Новая запись',
  AppointmentCancelled: 'Запись отменена',
  ComplaintUpdated: 'Обновление жалоб',
  XrayUploaded: 'Загружен снимок',
  DiagnosisSaved: 'Диагноз сохранён',
  TreatmentCompleted: 'Лечение завершено',
  InvoiceCreated: 'Счёт создан',
  PaymentReceived: 'Оплата получена',
  PaymentOverdue: 'Просрочка',
  InventoryLow: 'Мало на складе',
  LabOrderCreated: 'Лаб. заказ',
  LabOrderCompleted: 'Лаб. заказ готов',
  DailySummary: 'Сводка дня',
  FollowUpDue: 'Follow-up',
  AppointmentReminder: 'Напоминание',
}

const AGENT_COLORS: Record<string, string> = {
  doctor: 'text-blue-400 bg-blue-400/10',
  clinical: 'text-emerald-400 bg-emerald-400/10',
  radiology: 'text-purple-400 bg-purple-400/10',
  documentation: 'text-cyan-400 bg-cyan-400/10',
  shop: 'text-amber-400 bg-amber-400/10',
  finance: 'text-green-400 bg-green-400/10',
  admin: 'text-orange-400 bg-orange-400/10',
  followup: 'text-pink-400 bg-pink-400/10',
  patient: 'text-sky-400 bg-sky-400/10',
  ceo: 'text-red-400 bg-red-400/10',
  reception: 'text-indigo-400 bg-indigo-400/10',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-amber-400',
  medium: 'text-blue-400',
  low: 'text-gray-400',
}

// ─── Subcomponents ───

function TimelineDot({ success }: { success: boolean }) {
  return (
    <div className="relative">
      <div
        className={cn(
          'w-3 h-3 rounded-full border-2',
          success
            ? 'bg-green-400/20 border-green-400'
            : 'bg-red-400/20 border-red-400'
        )}
      />
      <div
        className={cn(
          'absolute inset-0 w-3 h-3 rounded-full animate-ping',
          success ? 'bg-green-400/30' : 'bg-red-400/30'
        )}
      />
    </div>
  )
}

function ActionChip({ action }: { action: TimelineAction }) {
  const color = AGENT_COLORS[action.agent] || 'text-gray-400 bg-gray-400/10'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
        color,
        'border-current/20'
      )}
    >
      <Bot size={14} />
      <span className="font-medium">{action.agent}</span>
      <span className="text-muted-foreground">·</span>
      <span className="truncate">{action.action}</span>
      {action.success ? (
        <CheckCircle size={12} className="text-green-400 ml-auto" />
      ) : (
        <AlertTriangle size={12} className="text-red-400 ml-auto" />
      )}
    </motion.div>
  )
}

function TimelineEntryCard({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false)
  const eventLabel = EVENT_LABELS[entry.event.type] || entry.event.type
  const successCount = entry.results.filter((r) => r.success).length
  const totalCount = entry.results.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex gap-4"
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <TimelineDot success={successCount === totalCount} />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Card */}
      <Card className="flex-1 p-4 mb-4 hover:bg-accent/50 transition-colors">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}
              <Zap size={14} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{eventLabel}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.event.source}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock size={10} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.processedAt).toLocaleTimeString('ru-RU')}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {entry.durationMs}ms
                </span>
                <span
                  className={cn(
                    'text-xs',
                    successCount === totalCount
                      ? 'text-green-400'
                      : 'text-red-400'
                  )}
                >
                  · {successCount}/{totalCount} OK
                </span>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 border-t pt-3">
                {/* Rules matched */}
                {entry.rules.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Правила:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.rules.map((rule) => (
                        <span
                          key={rule.id}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            PRIORITY_COLORS[rule.priority] || 'text-gray-400',
                            'bg-current/10'
                          )}
                        >
                          {rule.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-1">
                  {entry.results.map((action, i) => (
                    <ActionChip key={i} action={action} />
                  ))}
                </div>

                {/* Messages */}
                {entry.results.some((r) => r.message) && (
                  <div className="mt-2 space-y-1">
                    {entry.results
                      .filter((r) => r.message)
                      .map((r, i) => (
                        <div
                          key={i}
                          className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
                        >
                          <span className="font-medium">{r.agent}:</span>{' '}
                          {r.message}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ───

export function AITimeline({
  entries,
  maxVisible = 20,
  onRefresh,
  loading = false,
}: AITimelineProps) {
  const [filter, setFilter] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(maxVisible)

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter(
      (e) =>
        e.event.type === filter ||
        e.results.some((r) => r.agent === filter)
    )
  }, [entries, filter])

  const visibleEntries = filteredEntries.slice(0, visibleCount)

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(entries.map((e) => e.event.type))
    return Array.from(types)
  }, [entries])

  const uniqueAgents = useMemo(() => {
    const agents = new Set(entries.flatMap((e) => e.results.map((r) => r.agent)))
    return Array.from(agents)
  }, [entries])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          <h3 className="text-sm font-medium">AI Event Timeline</h3>
          <span className="text-xs text-muted-foreground">
            {filteredEntries.length} событий
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs bg-transparent border rounded px-2 py-1 text-muted-foreground"
            >
              <option value="all">Все</option>
              {uniqueEventTypes.map((type) => (
                <option key={type} value={type}>
                  {EVENT_LABELS[type] || type}
                </option>
              ))}
              {uniqueAgents.map((agent) => (
                <option key={agent} value={agent}>
                  Agent: {agent}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw
                size={14}
                className={cn('text-muted-foreground', loading && 'animate-spin')}
              />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {visibleEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Нет событий для отображения
          </div>
        ) : (
          <>
            {visibleEntries.map((entry) => (
              <TimelineEntryCard key={entry.id} entry={entry} />
            ))}

            {/* Load more */}
            {filteredEntries.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((v) => v + maxVisible)}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Показать ещё ({filteredEntries.length - visibleCount})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
