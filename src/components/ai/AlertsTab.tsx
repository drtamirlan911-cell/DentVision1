import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Info, CheckCircle, XCircle, Bell,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
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

export function AlertsTab() {
  const proactiveAlerts = useAIStore((s) => s.proactiveAlerts)
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts)

  useEffect(() => {
    if (proactiveAlerts.length === 0) {
      loadProactiveAlerts()
    }
  }, [])

  if (proactiveAlerts.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {proactiveAlerts.map((alert, i) => {
          const config = PRIORITY_CONFIG[alert.priority] || PRIORITY_CONFIG.low
          const Icon = config.icon

          return (
            <motion.div
              key={`${alert.message}-${i}`}
              initial={{ opacity: 0, x: -12, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.97 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <GlassCard
                padding="sm"
                className={cn('group border-l-2', config.border.replace('bg', 'border-l').replace('/10', '/30'))}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      config.bg, config.border
                    )}
                  >
                    <Icon size={15} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        variant={
                          alert.priority === 'high' ? 'error' :
                          alert.priority === 'medium' ? 'warning' : 'info'
                        }
                        size="xs"
                        dot
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-txt-primary leading-snug">
                      {alert.message}
                    </p>
                    {alert.action && (
                      <button className="flex items-center gap-1 mt-2 text-2xs text-dv-gold hover:text-dv-gold/80 transition-colors">
                        {alert.action.type === 'openPatientCard' ? 'Открыть карту' : 'Выполнить'}
                        <ArrowRight size={11} />
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
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center text-center py-12 px-6"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 mb-4">
        <Bell size={28} className="text-txt-muted/50" />
      </div>
      <h3 className="text-base font-semibold text-txt-primary mb-1">Нет оповещений</h3>
      <p className="text-sm text-txt-muted max-w-[240px] leading-relaxed">
        AI присылает сюда важные события клиники: просрочки, риск no-show, истечение подписки, задачи на сегодня.
      </p>
    </motion.div>
  )
}
