import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, User, Brain, Bell, Bot, CalendarDays, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextTab } from '@/components/ai/ContextTab'
import { DigitalTwin } from '@/components/ai/DigitalTwin'
import { AlertsTab } from '@/components/ai/AlertsTab'
import { AgentActivityTab } from '@/components/ai/AgentActivityTab'
import { useAIStore } from '@/store/ai.store'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'

type TabId = 'context' | 'digital-twin' | 'alerts' | 'activity'

interface ContextPanelProps { onClose?: () => void; clinic?: any; user?: any; role?: any }

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { user } = useAuth()
  const isGuest = useGuestStore((s) => s.isGuest) || !user
  const [activeTab, setActiveTab] = useState<TabId>(isGuest ? 'digital-twin' : 'context')
  const alertCount = useAIStore((s) => s.proactiveAlerts.length)

  const tabs: { id: TabId; label: string; hint: string; icon: React.ElementType }[] = [
    { id: 'context', label: 'Контекст', hint: isGuest ? 'Что открыто сейчас' : 'Текущий объект работы', icon: User },
    { id: 'digital-twin', label: 'Двойник', hint: isGuest ? 'Гид по платформе' : 'Профиль для AI', icon: Brain },
    { id: 'alerts', label: 'Оповещения', hint: isGuest ? 'Подсказки для гостя' : 'AI-сигналы клиники', icon: Bell },
    ...(isGuest ? [] : [{ id: 'activity' as TabId, label: 'Активность', hint: 'Что делал ИИ', icon: Bot }]),
  ]

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="flex h-full flex-col overflow-hidden bg-surface-1">
      <div className="flex min-h-12 items-center justify-between border-b border-bdr-subtle px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-ghost xl:flex"><Sparkles size={12} className="text-dv-gold" /> Live context</span>
          <div className="flex items-center gap-0.5" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return <button key={tab.id} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)} title={tab.hint} className={cn('relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all', isActive ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-muted hover:bg-white/[0.03] hover:text-txt-secondary')}><Icon size={14} /><span className="text-[11px]">{tab.label}</span>{tab.id === 'alerts' && alertCount > 0 && <span className="min-w-[16px] rounded-full bg-red-400/20 px-1 text-center text-[9px] font-bold text-red-400">{alertCount > 9 ? '9+' : alertCount}</span>}</button>
            })}
          </div>
        </div>
        <button aria-label="Close panel" onClick={onClose} className="rounded-lg p-1.5 text-txt-muted transition-colors hover:bg-white/5 hover:text-txt-primary"><X size={16} /></button>
      </div>

      <div className="border-b border-bdr-subtle px-3 py-3">
        <div className="mb-2 flex items-center gap-2"><CalendarDays size={15} className="text-dv-gold" /><span className="text-xs font-semibold text-txt-primary">Сегодня</span><span className="text-[10px] text-txt-ghost">операционный контекст</span></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><div className="text-sm font-semibold text-txt-primary">—</div><div className="text-[9px] text-txt-muted">Пациенты</div></div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><div className="text-sm font-semibold text-txt-primary">—</div><div className="text-[9px] text-txt-muted">Задачи</div></div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><div className="text-sm font-semibold text-txt-primary">{alertCount}</div><div className="text-[9px] text-txt-muted">AI сигналы</div></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'context' && <ContextTab />}
        {activeTab === 'digital-twin' && <DigitalTwin />}
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'activity' && <AgentActivityTab />}
      </div>
    </motion.div>
  )
}
