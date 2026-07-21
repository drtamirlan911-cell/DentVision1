import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Info, CheckCircle, Bell, ArrowRight, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { useAIStore } from '@/store/ai.store'

const PRIORITY_CONFIG = {
  high: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
    label: 'Высокий',
  },
  medium: {
    icon: Info,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    label: 'Средний',
  },
  low: {
    icon: CheckCircle,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    label: 'Низкий',
  },
}

const ACTION_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenCashier: '/crm/finance',
  OpenInventory: '/crm/inventory',
  OpenBilling: '/crm/billing',
  OpenSchool: '/school',
  OpenSchoolWorkspace: '/school-workspace',
  OpenProfile: '/profile',
  OpenPatients: '/crm/patients',
  OpenLab: '/crm/lab',
  OpenNotifications: '/crm/reminders',
  GetPendingAppointments: '/crm/schedule',
}

export function AlertsTab() {
  const navigate = useNavigate()
  const proactiveAlerts = useAIStore((s) => s.proactiveAlerts)
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts)

  useEffect(() => {
    void loadProactiveAlerts()
  }, [loadProactiveAlerts])

  const openAction = (type?: string) => {
    if (!type) return
    const path = ACTION_PATHS[type]
    if (path) navigate(path)
  }

  if (proactiveAlerts.length === 0) {
    return (
      <div className="space-y-3 p-3">
        <EmptyState />
        <Button size="sm" variant="secondary" className="w-full" icon={<RefreshCw size={14} />} onClick={() => loadProactiveAlerts()}>
          Обновить оповещения
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-[11px] text-txt-muted">AI-сигналы клиники · {proactiveAlerts.length}</p>
        <button type="button" onClick={() => loadProactiveAlerts()} className="text-txt-muted hover:text-dv-gold p-1">
          <RefreshCw size={12} />
        </button>
      </div>
      <AnimatePresence mode="popLayout">
        {proactiveAlerts.map((alert, i) => {
          const config = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.low
          const Icon = config.icon
          const actionType = alert.action?.type

          return (
            <motion.div
              key={`${alert.message}-${i}`}
              initial={{ opacity: 0, x: -12, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.97 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <GlassCard padding="sm" className={cn('group border-l-2', config.border)}>
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                    <Icon size={15} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" size="xs">{config.label}</Badge>
                      <span className="text-[10px] text-txt-ghost uppercase">{alert.type}</span>
                    </div>
                    <p className="text-xs text-txt-primary leading-snug">{alert.message}</p>
                    {actionType && ACTION_PATHS[actionType] && (
                      <button
                        type="button"
                        onClick={() => openAction(actionType)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-dv-gold hover:underline"
                      >
                        Открыть <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-10 px-6"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 mb-3">
        <Bell size={24} className="text-txt-muted/50" />
      </div>
      <h3 className="text-sm font-semibold text-txt-primary mb-1">Нет оповещений</h3>
      <p className="text-xs text-txt-muted max-w-[240px] leading-relaxed">
        Здесь появятся сигналы: неоплата, ближайшие записи, низкий склад, истечение подписки, курсы в процессе.
      </p>
    </motion.div>
  )
}
