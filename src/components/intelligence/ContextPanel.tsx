import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, Brain, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextTab } from '@/components/ai/ContextTab'
import { DigitalTwin } from '@/components/ai/DigitalTwin'
import { AlertsTab } from '@/components/ai/AlertsTab'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'

type TabId = 'context' | 'digital-twin' | 'alerts'

interface ContextPanelProps {
  onClose?: () => void
  clinic?: any
  user?: any
  role?: any
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { user } = useAuth()
  const isGuest = useGuestStore((s) => s.isGuest) && !user
  const [activeTab, setActiveTab] = useState<TabId>(isGuest ? 'digital-twin' : 'context')
  const alertCount = useAIStore((s) => s.proactiveAlerts.length)

  const tabs: { id: TabId; label: string; hint: string; icon: React.ElementType }[] = [
    {
      id: 'context',
      label: 'Контекст',
      hint: isGuest ? 'Что открыто сейчас' : 'Текущий объект работы',
      icon: User,
    },
    {
      id: 'digital-twin',
      label: 'Двойник',
      hint: isGuest ? 'Гид по платформе' : 'Профиль для AI',
      icon: Brain,
    },
    {
      id: 'alerts',
      label: 'Оповещения',
      hint: isGuest ? 'Подсказки для гостя' : 'AI-сигналы клиники',
      icon: Bell,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="flex flex-col h-full bg-surface-1 overflow-hidden"
    >
      <div className="flex items-center justify-between h-12 px-3 border-b border-bdr-subtle flex-shrink-0">
        <div className="flex items-center gap-0.5" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-dv-gold/10 text-dv-gold shadow-sm'
                    : 'text-txt-muted hover:text-txt-secondary hover:bg-white/[0.03]'
                )}
                title={tab.hint}
              >
                <Icon size={15} />
                <span className="text-xs">{tab.label}</span>
                {tab.id === 'alerts' && alertCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-400/20 text-red-400 text-2xs font-bold px-1">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-lg bg-dv-gold/10 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-3"
            >
              <ContextTab />
            </motion.div>
          )}
          {activeTab === 'digital-twin' && (
            <motion.div
              key="digital-twin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-3"
            >
              <DigitalTwin />
            </motion.div>
          )}
          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-3"
            >
              <AlertsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
