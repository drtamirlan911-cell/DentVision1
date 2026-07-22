import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, CheckCircle, X, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { normalizeAlertTone } from '@/utils/alertTone'
import { cn } from '@/lib/utils'
import { resolveNavigationPath, useAIExecutor } from '@/utils/aiExecutor'
import { dismissAlertPersist, dismissAlertsPersist } from '@/utils/dismissedAlerts'

interface Alert {
  id: string
  type: string
  category: string
  text: string
  priority: number
  action?: { type: string; params?: Record<string, unknown> }
  acknowledged?: boolean
  resolved?: boolean
  timestamp?: Date
}

interface ProactiveAlertsDisplayProps {
  alerts: Alert[]
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  maxVisible?: number
}

const COLORS = {
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertTriangle,
}

const CATEGORY_LABELS: Record<string, string> = {
  product: 'Платформа',
  platform: 'Платформа',
  setup: 'Настройка',
  clinic: 'Клиника',
  finance: 'Финансы',
  schedule: 'Расписание',
  inventory: 'Склад',
  general: 'Общее',
}

const ACTION_LABELS: Record<string, string> = {
  OpenDemo: 'Демо',
  OpenShop: 'Маркет',
  OpenSchool: 'Academy',
  OpenPricing: 'Тарифы',
  OpenJobs: 'Вакансии',
  OpenCommunity: 'Сеть',
  OpenProfile: 'Профиль',
  OpenCRM: 'CRM',
  OpenSchedule: 'Расписание',
  OpenPatients: 'Пациенты',
  OpenFinance: 'Финансы',
  OpenInventory: 'Склад',
  NAVIGATE: 'Открыть',
}

export function ProactiveAlertsDisplay({
  alerts,
  onAcknowledge,
  onResolve,
  maxVisible = 3,
}: ProactiveAlertsDisplayProps) {
  const { executeAction } = useAIExecutor()
  const [expanded, setExpanded] = useState(false)

  const activeAlerts = useMemo(
    () =>
      [...alerts]
        .filter((a) => !a.acknowledged && !a.resolved && a.text)
        .sort((a, b) => b.priority - a.priority),
    [alerts],
  )

  if (!activeAlerts.length) return null

  const visibleAlerts = expanded ? activeAlerts.slice(0, maxVisible) : activeAlerts.slice(0, 1)
  const hiddenCount = Math.max(0, activeAlerts.length - visibleAlerts.length)

  const dismissOne = (alert: Alert) => {
    dismissAlertPersist(alert)
    onAcknowledge(alert.id)
  }

  const dismissAll = () => {
    dismissAlertsPersist(activeAlerts)
    for (const a of activeAlerts) onAcknowledge(a.id)
  }

  const handleActionClick = async (alert: Alert) => {
    const actionType = alert.action?.type
    if (!actionType) return

    const path = resolveNavigationPath(actionType, alert.action?.params)
    const result = await executeAction({
      id: `alert-${alert.id}`,
      type: actionType,
      label: ACTION_LABELS[actionType] || actionType,
      confidence: 1,
      params: alert.action?.params || (path ? { path } : {}),
      requiresConfirmation: false,
    })

    if (result?.type === 'navigate' || path) {
      dismissOne(alert)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="mx-3 sm:mx-4 md:mx-6 mb-1 max-w-3xl shrink-0"
    >
      <div className="rounded-xl border border-white/[0.08] bg-surface-1/80 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/[0.04]">
          <Sparkles size={12} className="text-dv-gold shrink-0" />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
          >
            <span className="text-[11px] font-semibold text-txt-secondary truncate">
              {activeAlerts.length === 1
                ? 'Подсказка'
                : `${activeAlerts.length} подсказки`}
            </span>
            {hiddenCount > 0 && !expanded && (
              <span className="text-[10px] text-txt-muted shrink-0">+{hiddenCount}</span>
            )}
            <ChevronDown
              size={12}
              className={cn('text-txt-muted shrink-0 transition-transform ml-auto', expanded && 'rotate-180')}
            />
          </button>
          <button
            type="button"
            onClick={dismissAll}
            className="shrink-0 px-2 py-1 rounded-md text-[10px] font-medium text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            aria-label="Скрыть все подсказки"
          >
            Скрыть
          </button>
        </div>

        <AnimatePresence initial={false}>
          {visibleAlerts.map((alert) => {
            const tone = normalizeAlertTone(alert.type)
            const AlertIcon = ICONS[tone]
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="border-b border-white/[0.04] last:border-b-0"
              >
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                      COLORS[tone],
                    )}
                  >
                    <AlertIcon size={12} />
                  </div>
                  <p className="flex-1 min-w-0 text-[12px] leading-snug text-txt-primary line-clamp-2">
                    {alert.text}
                  </p>
                  {alert.action?.type && (
                    <button
                      type="button"
                      onClick={() => void handleActionClick(alert)}
                      className="shrink-0 px-2 py-1 rounded-md text-[10px] font-semibold bg-dv-gold/15 text-dv-gold border border-dv-gold/25 hover:bg-dv-gold/25 transition-colors flex items-center gap-0.5"
                    >
                      {ACTION_LABELS[alert.action.type] || 'Открыть'}
                      <ChevronRight size={10} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissOne(alert)}
                    className="shrink-0 p-1.5 rounded-md text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                    aria-label="Скрыть"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {expanded && activeAlerts.length > maxVisible && (
          <button
            type="button"
            onClick={() => onResolve(activeAlerts[0].id)}
            className="w-full px-2.5 py-1.5 text-[10px] text-txt-muted hover:text-txt-secondary transition-colors"
          >
            Ещё {activeAlerts.length - maxVisible} в панели контекста
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function ProactiveAlertsCompact({
  alerts,
  onAcknowledge,
  onAction,
  maxVisible = 3,
}: ProactiveAlertsDisplayProps & { onAction?: (type: string) => void }) {
  const active = useMemo(
    () =>
      [...alerts]
        .filter((a) => !a.acknowledged && !a.resolved && a.text)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxVisible),
    [alerts, maxVisible],
  )

  if (!active.length) return null

  return (
    <div className="space-y-1.5">
      <AnimatePresence>
        {active.map((alert, i) => {
          const tone = normalizeAlertTone(alert.type)
          const AlertIcon = ICONS[tone]
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border',
                COLORS[tone],
              )}
            >
              <AlertIcon size={12} className="shrink-0" />
              <p className="flex-1 min-w-0 text-[11px] text-txt-primary line-clamp-1">{alert.text}</p>
              <span className="text-[9px] text-txt-muted shrink-0 hidden sm:inline">
                {CATEGORY_LABELS[alert.category] || alert.category}
              </span>
              {alert.action && onAction && (
                <button
                  type="button"
                  onClick={() => onAction(alert.action!.type)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-txt-secondary hover:bg-white/20"
                >
                  {ACTION_LABELS[alert.action.type] || 'Открыть'}
                </button>
              )}
              {onAcknowledge && (
                <button
                  type="button"
                  onClick={() => {
                    dismissAlertPersist(alert)
                    onAcknowledge(alert.id)
                  }}
                  className="p-1 rounded text-txt-muted hover:text-txt-primary"
                  aria-label="Скрыть"
                >
                  <X size={11} />
                </button>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
