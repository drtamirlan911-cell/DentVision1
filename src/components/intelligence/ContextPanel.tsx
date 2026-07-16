import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, BarChart3, Brain, Zap, Users, Calendar, FlaskConical, DollarSign, BookOpen, Settings2, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { aiProactive, aiDigitalTwin } from '@/utils/api'
import { StaggerContainer, StaggerItem } from '@/components/ui/motion'

interface ContextPanelProps {
  onClose: () => void
  clinic: any
  user: any
  role: any
}

export function ContextPanel({ onClose, clinic, user, role }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<'context' | 'twin' | 'alerts'>('context')
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([])
  const [digitalTwin, setDigitalTwin] = useState<any>(null)
  const [loadingTwin, setLoadingTwin] = useState(true)

  useEffect(() => {
    aiProactive()
      .then(d => {
        if (d?.alerts?.length) setProactiveAlerts(d.alerts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoadingTwin(true)
    aiDigitalTwin()
      .then(d => {
        if (d?.twin) setDigitalTwin(d.twin)
      })
      .catch(() => {})
      .finally(() => setLoadingTwin(false))
  }, [])

  const tabs = [
    { id: 'context', label: 'Контекст', icon: Brain },
    { id: 'twin', label: 'Цифровой двойник', icon: Zap },
    { id: 'alerts', label: 'Оповещения', icon: Zap, count: proactiveAlerts.length },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="flex flex-col h-full bg-surface-1 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-bdr-subtle flex-shrink-0">
        <div className="flex items-center gap-1" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-dv-gold/10 text-dv-gold'
                  : 'text-txt-secondary hover:bg-white/5 hover:text-txt-primary'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.count && (
                <Badge variant="gold" size="xs">{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-4"
            >
              <ContextTabContext clinic={clinic} user={user} role={role} />
            </motion.div>
          )}
          {activeTab === 'twin' && (
            <motion.div
              key="twin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-4"
            >
              <ContextTabTwin twin={digitalTwin} loading={loadingTwin} />
            </motion.div>
          )}
          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 space-y-3"
            >
              <ContextTabAlerts alerts={proactiveAlerts} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function ContextTabContext({ clinic, user, role }: { clinic: any; user: any; role: any }) {
  return (
    <>
      {/* Workspace */}
      <GlassCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/90">Рабочее пространство</h3>
          <Badge variant="gold" size="xs">{role?.label || 'Сотрудник'}</Badge>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-white/60">
            <span>Клиника</span>
            <span className="font-medium text-white/90">{clinic?.name || '—'}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Пользователь</span>
            <span className="font-medium text-white/90">{user?.name || user?.login}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Роль</span>
            <span className="font-medium text-white/90">{role?.label || '—'}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>План</span>
            <span className="font-medium text-white/90 text-dv-gold">{clinic?.plan || 'demo'}</span>
          </div>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatItem icon={<Calendar size={14} />} label="Записей сегодня" value="18" />
        <StatItem icon={<Users size={14} />} label="Пациентов" value="342" />
        <StatItem icon={<FlaskConical size={14} />} label="Лаб. заказов" value="5" />
        <StatItem icon={<DollarSign size={14} />} label="Выручка" value="485 000 ₸" />
      </div>

      {/* AI Skills */}
      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-white/90 mb-3">AI Навыки</h3>
        <div className="flex flex-wrap gap-2">
          {['Clinical', 'Practice', 'Shopping', 'Learning', 'Analytics', 'Research', 'Automation'].map(skill => (
            <Badge key={skill} variant="outline" size="xs">{skill}</Badge>
          ))}
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-white/90 mb-3">Быстрые действия</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Новая запись', icon: <Calendar size={12} /> },
            { label: 'Найти пациента', icon: <Users size={12} /> },
            { label: 'Создать счёт', icon: <DollarSign size={12} /> },
            { label: 'Лаб. заказ', icon: <FlaskConical size={12} /> },
          ].map((action, i) => (
            <button key={i} className="flex items-center justify-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/5 transition-colors text-left group">
              <span className="text-txt-muted group-hover:text-dv-gold transition-colors">{action.icon}</span>
              <span className="text-sm font-medium text-white/80">{action.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>
    </>
  )
}

function ContextTabTwin({ twin, loading }: { twin: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!twin) {
    return (
      <GlassCard padding="md" className="text-center py-8">
        <p className="text-white/40">Цифровой двойник недоступен</p>
      </GlassCard>
    )
  }

  return (
    <>
      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-white/90 mb-3">Специализация</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-white/60">
            <span>Специальность</span>
            <span className="font-medium text-white/90 text-dv-gold">{twin.specialty || '—'}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Уровень экспертизы</span>
            <span className="font-medium text-white/90">{twin.expertiseLevel || '—'}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>Активность</span>
            <span className="font-medium text-white/90">{twin.activityLevel || '—'}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-white/90 mb-3">Оборудование</h3>
        <div className="flex flex-wrap gap-2">
          {(twin.equipment || []).slice(0, 5).map((item: any, i: number) => (
            <Badge key={i} variant="gold" size="xs">{item}</Badge>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-white/90 mb-3">Обучение</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-white/60">
            <span>Пройдено курсов</span>
            <span className="font-medium text-white/90">{twin.completedCourses || 0}</span>
          </div>
          <div className="flex justify-between text-white/60">
            <span>В процессе</span>
            <span className="font-medium text-white/90">{twin.inProgressCourses || 0}</span>
          </div>
        </div>
      </GlassCard>
    </>
  )
}

function ContextTabAlerts({ alerts }: { alerts: Array<{ type: string; text: string; priority: number }> }) {
  if (!alerts.length) {
    return (
      <GlassCard padding="md" className="text-center py-8">
        <p className="text-white/40">Нет активных оповещений</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <GlassCard key={i} padding="sm" className="group">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
              <Zap size={14} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90">{alert.text}</p>
              <p className="text-[10px] text-white/40">Приоритет: {alert.priority}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <GlassCard padding="md">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white/50">{icon}</span>
        <span className="text-[10px] text-white/40">{label}</span>
      </div>
      <p className="text-lg font-bold text-white/90">{value}</p>
    </GlassCard>
  )
}