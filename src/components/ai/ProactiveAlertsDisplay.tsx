import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, AlertTriangle, Info, CheckCircle, X, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor } from '@/utils/aiExecutor'

interface Alert {
  id: string
  type: 'info' | 'warning' | 'success' | 'error'
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

export function ProactiveAlertsDisplay({ 
  alerts, 
  onAcknowledge, 
  onResolve, 
  maxVisible = 4 
}: ProactiveAlertsDisplayProps) {
  if (!alerts.length) return null

  const { executeAction } = useAIExecutor()
  const sortedAlerts = [...alerts].sort((a, b) => b.priority - a.priority)
  const visibleAlerts = sortedAlerts.slice(0, maxVisible)

  const handleActionClick = async (actionType: string, params?: Record<string, unknown>) => {
    await executeAction({
      id: `action-${Date.now()}`,
      type: actionType,
      label: actionType,
      confidence: 1,
      params,
      requiresConfirmation: true,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="mx-4 md:mx-6 mt-4 max-w-3xl"
    >
      <AnimatePresence>
        {visibleAlerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 20, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, x: 30, scale: 0.95 }}
            transition={{ 
              delay: i * 0.08, 
              type: 'spring', 
              stiffness: 400, 
              damping: 28 
            }}
            className={cn(
              'relative flex gap-3 p-3.5 rounded-2xl border transition-all duration-300',
              COLORS[alert.type],
              'shadow-lg shadow-black/20'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
              {(() => {
                const AlertIcon = ICONS[alert.type]
                return <AlertIcon size={16} className={cn(COLORS[alert.type].split(' ')[0])} />
              })()}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-txt-primary pr-4">{alert.text}</p>
                <div className="flex items-center gap-1">
                  {alert.action && (
                    <motion.button
                      onClick={() => handleActionClick(alert.action!.type, alert.action!.params)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-txt-secondary hover:bg-white/20 transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={10} />
                      Выполнить
                    </motion.button>
                  )}
                  {!alert.acknowledged && (
                    <motion.button
                      onClick={() => onAcknowledge(alert.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                    >
                      <X size={12} />
                    </motion.button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-txt-muted capitalize">
                  {alert.category}
                </span>
                {alert.timestamp && (
                  <span className="text-[10px] text-txt-ghost">
                    {alert.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {sortedAlerts.length > maxVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 md:mx-6 mt-2"
        >
          <motion.button
            onClick={() => onResolve(sortedAlerts[0].id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-txt-muted hover:bg-white/10 hover:text-txt-secondary transition-all text-sm font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            Показать все {sortedAlerts.length} оповещений
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  )
}

export function ProactiveAlertsCompact({ 
  alerts, 
  onAcknowledge, 
  onAction,
  maxVisible = 3 
}: ProactiveAlertsDisplayProps & { onAction?: (type: string) => void }) {
  if (!alerts.length) return null

  const sortedAlerts = [...alerts].sort((a, b) => b.priority - a.priority)
  const visibleAlerts = sortedAlerts.slice(0, maxVisible)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2"
    >
      <AnimatePresence>
        {visibleAlerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.1 }}
            className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-xl border transition-all',
              COLORS[alert.type]
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
              {(() => {
                const AlertIcon = ICONS[alert.type]
                return <AlertIcon size={12} className={cn(COLORS[alert.type].split(' ')[0])} />
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-txt-primary">{alert.text}</p>
              <p className="text-2xs text-txt-muted mt-0.5 capitalize">{alert.category}</p>
            </div>
            {alert.action && onAction && (
              <motion.button
                onClick={() => onAction(alert.action!.type)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-txt-secondary hover:bg-white/20 transition-colors"
              >
                Действие
              </motion.button>
            )}
            {onAcknowledge && (
              <motion.button
                onClick={() => onAcknowledge(alert.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              >
                <X size={12} />
              </motion.button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}