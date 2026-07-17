import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Info, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import * as api from '@/utils/api'

interface GreetingData {
  greeting: string
  alerts: Array<{ type: string; priority: string; message: string }>
}

function AlertIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    info: <Info size={12} />,
    warning: <AlertTriangle size={12} />,
    success: <CheckCircle size={12} />,
    error: <AlertTriangle size={12} />,
  }
  return icons[type] || icons.info
}

const ALERT_COLORS: Record<string, string> = {
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export function GreetingArea() {
  const user = useAuthStore((s) => s.user)
  const [greeting, setGreeting] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<GreetingData['alerts']>([])
  const [loading, setLoading] = useState(true)

  const getLocalGreeting = () => {
    const h = new Date().getHours()
    if (h < 6) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  const name = user?.name?.split(' ')[0] || user?.login || 'Пользователь'

  useEffect(() => {
    let mounted = true
    setLoading(true)

    api.aiChat('Приветствие', []).then((res) => {
      if (!mounted) return
      if (res?.reply) {
        setGreeting(res.reply)
      }
      if (res?.proactive?.length) {
        setAlerts(
          res.proactive.slice(0, 3).map((a: any) => ({
            type: a.type || 'info',
            priority: a.priority >= 8 ? 'high' : a.priority >= 4 ? 'medium' : 'low',
            message: a.text,
          }))
        )
      }
    }).catch(() => {
      if (!mounted) return
      setGreeting(null)
    }).finally(() => {
      if (mounted) setLoading(false)
    })

    return () => { mounted = false }
  }, [])

  const displayGreeting = greeting || `${getLocalGreeting()}, ${name}!`

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="px-4 md:px-6 pt-4 pb-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-32 rounded-md bg-surface-2 animate-pulse" />
              <div className="h-5 w-20 rounded-md bg-surface-2 animate-pulse" />
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-txt-primary truncate">
              <motion.span
                key={displayGreeting}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                {displayGreeting}
              </motion.span>
            </h2>
          )}
          <p className="text-xs text-txt-muted mt-0.5">
            DentVision Intelligence
          </p>
        </div>

        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                {alerts.length}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 space-y-1 overflow-hidden"
          >
            {alerts.map((alert, i) => (
              <motion.div
                key={`${alert.message}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.15 }}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs',
                  ALERT_COLORS[alert.type] || ALERT_COLORS.info
                )}
              >
                <AlertIcon type={alert.type} />
                <span className="font-medium truncate">{alert.message}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
