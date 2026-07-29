import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/store/ai.store'
import { RingSpinner } from '@/components/ui/motion'

const statusConfig = {
  idle: { label: '', icon: null, color: 'text-txt-muted' },
  thinking: {
    label: 'Думаю...',
    icon: 'spinner',
    color: 'text-dv-gold',
  },
  executing: {
    label: 'Выполняю...',
    icon: 'loader',
    color: 'text-dv-gold',
  },
  result: {
    label: 'Готово',
    icon: 'check',
    color: 'text-green-400',
  },
  error: {
    label: 'Ошибка',
    icon: 'error',
    color: 'text-red-400',
  },
}

export function AIStatus() {
  const status = useAIStore((s) => s.status)
  const errorMessage = useAIStore((s) => s.errorMessage)

  const config = statusConfig[status]

  return (
    <AnimatePresence mode="wait">
      {status !== 'idle' && (
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium',
            status === 'error'
              ? 'bg-red-400/10 border-red-400/20 text-red-400'
              : status === 'result'
                ? 'bg-green-400/10 border-green-400/20 text-green-400'
                : 'bg-dv-gold/10 border-dv-gold/20 text-dv-gold'
          )}
        >
          {status === 'thinking' && (
            <RingSpinner size={16} thickness={2} color="gold" speed={1.2} />
          )}
          {status === 'executing' && (
            <Loader2 size={14} className="animate-spin" />
          )}
          {status === 'result' && (
            <CheckCircle size={14} />
          )}
          {status === 'error' && (
            <XCircle size={14} />
          )}

          <span>{config.label}</span>

          {status === 'error' && errorMessage && (
            <span className="text-red-400/70 ml-1 hidden sm:inline">
              — {errorMessage}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
