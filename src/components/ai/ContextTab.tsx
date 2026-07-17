import { motion } from 'framer-motion'
import {
  User, Phone, Calendar, FileText, Plus, Receipt, ScanLine, Activity, Clock, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { usePatientStore } from '@/store/patient.store'
import { formatDate } from '@/lib/utils'

const MOCK_TREATMENTS = [
  { date: '2026-06-15', procedure: 'Лечение кариеса 2.6', doctor: 'Иванова А.С.' },
  { date: '2026-05-20', procedure: 'Профессиональная гигиена', doctor: 'Иванова А.С.' },
  { date: '2026-04-10', procedure: 'Пломбирование 3.5', doctor: 'Петров В.К.' },
]

export function ContextTab() {
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const patientData = usePatientStore((s) => s.patientData)

  if (!selectedPatient || !patientData) {
    return <EmptyState />
  }

  return (
    <div className="space-y-3">
      <GlassCard padding="md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dv-gold/10">
            <User size={22} className="text-dv-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-txt-primary truncate">
              {patientData.name || 'Пациент'}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-txt-muted">
              {patientData.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} />
                  {patientData.phone}
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
        <div className="flex items-center gap-1.5 mb-3">
          <Activity size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">История лечения</h4>
        </div>
        <div className="space-y-0">
          {MOCK_TREATMENTS.map((tx, i) => (
            <div
              key={tx.date + tx.procedure}
              className={cn(
                'flex items-start gap-3 py-2.5',
                i !== MOCK_TREATMENTS.length - 1 && 'border-b border-bdr-subtle'
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
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

function QuickActions() {
  const actions = [
    { label: 'Открыть карту', icon: FileText },
    { label: 'Создать запись', icon: Plus },
    { label: 'Выписать счет', icon: Receipt },
    { label: 'Открыть КТ', icon: ScanLine },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 border border-bdr-subtle p-3 hover:bg-surface-3 transition-colors group"
        >
          <action.icon size={16} className="text-txt-muted group-hover:text-dv-gold transition-colors" />
          <span className="text-xs font-medium text-txt-secondary group-hover:text-txt-primary transition-colors">
            {action.label}
          </span>
        </button>
      ))}
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
        <Users size={28} className="text-txt-muted/50" />
      </div>
      <h3 className="text-base font-semibold text-txt-primary mb-1">Нет активного контекста</h3>
      <p className="text-sm text-txt-muted max-w-[200px]">
        Выберите пациента через AI или CRM
      </p>
    </motion.div>
  )
}
