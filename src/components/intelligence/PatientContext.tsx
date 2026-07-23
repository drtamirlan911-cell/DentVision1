import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Phone, Calendar, Clock, DollarSign, Activity,
  Camera, FileText, Plus, Receipt, ScanLine, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'

const MOCK_TREATMENTS = [
  { date: '2026-06-15', doctor: 'Иванова А.С.', procedure: 'Лечение кариеса 2.6', cost: 45000 },
  { date: '2026-05-20', doctor: 'Иванова А.С.', procedure: 'Проф. гигиена', cost: 15000 },
  { date: '2026-04-10', doctor: 'Петров В.К.', procedure: 'Пломбирование 3.5', cost: 35000 },
]

const MOCK_IMAGES = [
  { id: '1', label: 'ОПТГ', date: '15.06.2026' },
  { id: '2', label: 'ТРГ', date: '15.06.2026' },
  { id: '3', label: 'КЛКТ', date: '20.05.2026' },
]

interface PatientContextProps {
  patient: any
}

export function PatientContext({ patient }: PatientContextProps) {
  const [showAllTreatments, setShowAllTreatments] = useState(false)
  const treatments = showAllTreatments ? MOCK_TREATMENTS : MOCK_TREATMENTS.slice(0, 2)

  return (
    <div className="space-y-3">
      <GlassCard padding="md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dv-gold/10">
            <User size={22} className="text-dv-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-txt-primary truncate">
              {patient?.name || 'Пациент'}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-txt-muted">
              {patient?.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} />
                  {patient.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Последний визит: 15.06.2026
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      <QuickActions />

      <GlassCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
            <Activity size={14} className="text-dv-gold" />
            История лечения
          </h4>
          {MOCK_TREATMENTS.length > 2 && (
            <button
              onClick={() => setShowAllTreatments(!showAllTreatments)}
              className="text-2xs text-dv-gold hover:text-dv-gold/80 transition-colors"
            >
              {showAllTreatments ? 'Скрыть' : 'Все'}
            </button>
          )}
        </div>
        <AnimatePresence mode="popLayout">
          {treatments.map((tx, i) => (
            <motion.div
              key={tx.date + tx.procedure}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className={cn(
                'flex items-start gap-3 py-2.5',
                i !== treatments.length - 1 && 'border-b border-bdr-subtle'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                <Activity size={14} className="text-txt-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-txt-primary">{tx.procedure}</p>
                <div className="flex items-center gap-3 mt-0.5 text-2xs text-txt-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {tx.date}
                  </span>
                  <span>{tx.doctor}</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-txt-primary shrink-0">
                {tx.cost.toLocaleString()} ₸
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
            <Camera size={14} className="text-dv-gold" />
            Снимки
          </h4>
          <button className="text-2xs text-dv-gold hover:text-dv-gold/80 transition-colors">
            Все
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MOCK_IMAGES.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square rounded-xl bg-surface-2 border border-bdr-subtle overflow-hidden group cursor-pointer"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine size={28} className="text-txt-muted/40" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <p className="text-2xs font-medium text-white truncate">{img.label}</p>
                <p className="text-3xs text-white/60">{img.date}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
            <DollarSign size={14} className="text-dv-gold" />
            Финансы
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-2xs text-txt-muted">Общая сумма</p>
            <p className="text-sm font-bold text-txt-primary mt-1">485 000 ₸</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-2xs text-txt-muted">Оплачено</p>
            <p className="text-sm font-bold text-green-400 mt-1">420 000 ₸</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-2xs text-txt-muted">Долг</p>
            <p className="text-sm font-bold text-red-400 mt-1">65 000 ₸</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-2xs text-txt-muted">Скидка</p>
            <p className="text-sm font-bold text-dv-gold mt-1">15%</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

function QuickActions() {
  const actions = [
    { label: 'Открыть карту', icon: FileText, color: 'text-blue-400' },
    { label: 'Создать запись', icon: Plus, color: 'text-green-400' },
    { label: 'Выписать счет', icon: Receipt, color: 'text-amber-400' },
    { label: 'Открыть КТ', icon: ScanLine, color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 border border-bdr-subtle p-3 hover:bg-surface-3 transition-colors group"
        >
          <action.icon size={16} className={cn(action.color, 'group-hover:scale-110 transition-transform')} />
          <span className="text-xs font-medium text-txt-secondary group-hover:text-txt-primary transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}
