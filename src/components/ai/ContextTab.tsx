import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import {
  User, Phone, CalendarDays, CreditCard, FilePlus, Search,
  Stethoscope, Heart, Shield, AlertCircle, CheckCircle, GraduationCap, Store,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn, formatDate } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { usePatientStore } from '@/store/patient.store'

const TREATMENT_STAGES = [
  { id: 'diagnosis', label: 'Диагностика', icon: Search, color: 'text-blue-400' },
  { id: 'planning', label: 'Планирование', icon: FilePlus, color: 'text-purple-400' },
  { id: 'treatment', label: 'Лечение', icon: Stethoscope, color: 'text-green-400' },
  { id: 'control', label: 'Контроль', icon: Shield, color: 'text-amber-400' },
  { id: 'maintenance', label: 'Поддержание', icon: Heart, color: 'text-rose-400' },
]

interface PatientContextData {
  id: string
  name: string
  phone?: string
  nextVisit?: string
  treatmentStage?: string
  debt?: number
  avatar?: string
  notes?: string
  allergies?: string[]
  insurance?: string
}

/**
 * Right-rail «Контекст»: shows the current work object.
 * CRM → selected patient; Academy → school hint; Shop → seller hint.
 * Never shows a fake demo patient on non-CRM pages.
 */
export function ContextTab() {
  const location = useLocation()
  const navigate = useNavigate()
  const patientData = usePatientStore((s) => s.patientData)
  const selectedPatientId = usePatientStore((s) => s.selectedPatient)
  const { executeAction } = useAIExecutor()

  const path = location.pathname
  const isCrm = path.startsWith('/crm')
  const isSchool = path.startsWith('/school')
  const isShop = path.startsWith('/shop') || path === '/supplier'

  const patient: PatientContextData | null = patientData
    ? {
        id: String(patientData.id || selectedPatientId || ''),
        name:
          [patientData.lastName, patientData.firstName, patientData.middleName].filter(Boolean).join(' ')
          || patientData.name
          || 'Пациент',
        phone: patientData.phone,
        nextVisit: patientData.nextVisit,
        treatmentStage: patientData.treatmentStage || 'treatment',
        debt: Number(patientData.debt || 0) || undefined,
        allergies: Array.isArray(patientData.allergies) ? patientData.allergies : undefined,
        insurance: patientData.insurance,
        notes: patientData.notes,
        avatar: patientData.avatar || patientData.photoUrl,
      }
    : null

  if (isSchool) {
    return (
      <ScopeHint
        icon={<GraduationCap size={28} className="text-dv-gold" />}
        title="Академия"
        body="Каталог курсов для обучения. Кабинет школы — для лекторов: свои курсы, аналитика и выплаты."
        actionLabel="Открыть кабинет школы"
        onAction={() => navigate('/school-workspace')}
      />
    )
  }

  if (isShop) {
    return (
      <ScopeHint
        icon={<Store size={28} className="text-dv-gold" />}
        title="Маркетплейс"
        body="Покупка материалов. Кабинет продавца — для поставщиков: товары, склад, кошелёк."
        actionLabel="Кабинет продавца"
        onAction={() => navigate('/supplier')}
      />
    )
  }

  if (!isCrm || !patient) {
    return (
      <EmptyState
        title={isCrm ? 'Пациент не выбран' : 'Контекст раздела'}
        body={
          isCrm
            ? 'Выберите пациента в CRM — здесь появятся визиты, долг и быстрые действия.'
            : 'Эта панель показывает контекст текущего раздела: в CRM — пациент, в Академии — школа, в Маркетплейсе — продавец.'
        }
      />
    )
  }

  const currentStage = TREATMENT_STAGES.find((s) => s.id === patient.treatmentStage) || TREATMENT_STAGES[2]
  const stageIndex = TREATMENT_STAGES.findIndex((s) => s.id === currentStage.id)

  const quickActions = [
    { label: 'Карта', action: () => executeAction({ type: 'OpenMedicalCard', params: { patientId: patient.id } }) },
    { label: 'План', action: () => executeAction({ type: 'OpenTreatmentPlans', params: { patientId: patient.id } }) },
    { label: 'Оплата', action: () => executeAction({ type: 'OpenCashier', params: { patientId: patient.id } }) },
    { label: 'Запись', action: () => executeAction({ type: 'OpenSchedule', params: { patientId: patient.id } }) },
  ]

  return (
    <div className="space-y-4 p-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard padding="md" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-dv-gold/5 to-transparent" />
          <div className="relative flex items-start gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-dv-gold/20 to-dv-gold/5 border border-dv-gold/20 flex items-center justify-center shrink-0">
              {patient.avatar ? (
                <img src={patient.avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <User size={24} className="text-dv-gold" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-txt-primary truncate">{patient.name}</h3>
                <Badge variant="outline" className={cn('text-[10px]', currentStage.color)}>
                  {currentStage.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-txt-muted">
                {patient.phone && (
                  <span className="flex items-center gap-1"><Phone size={11} />{patient.phone}</span>
                )}
                {patient.nextVisit && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} />След.: {formatDate(patient.nextVisit)}
                  </span>
                )}
                {!!patient.debt && patient.debt > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <CreditCard size={11} />Долг: {patient.debt.toLocaleString('ru-RU')} ₸
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <GlassCard padding="md">
        <h4 className="text-xs font-semibold text-txt-primary mb-3">Этапы лечения</h4>
        <div className="flex justify-between gap-1">
          {TREATMENT_STAGES.map((stage, i) => {
            const Icon = stage.icon
            const done = i < stageIndex
            const current = i === stageIndex
            return (
              <div key={stage.id} className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  'h-8 w-8 rounded-lg border flex items-center justify-center',
                  current && 'border-dv-gold bg-dv-gold/10',
                  done && 'border-green-500/40 bg-green-500/10',
                  !current && !done && 'border-white/10 bg-white/[0.03]',
                )}>
                  {done ? <CheckCircle size={14} className="text-green-400" /> : <Icon size={14} className={current ? stage.color : 'text-txt-muted'} />}
                </div>
                <span className="text-[9px] text-txt-muted text-center leading-tight">{stage.label}</span>
              </div>
            )
          })}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <h4 className="text-xs font-semibold text-txt-primary mb-2">Быстрые действия</h4>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((a) => (
            <Button key={a.label} size="sm" variant="secondary" className="w-full" onClick={a.action}>
              {a.label}
            </Button>
          ))}
        </div>
      </GlassCard>

      {(patient.allergies?.length || patient.notes || patient.insurance) && (
        <GlassCard padding="md" className="space-y-2">
          {!!patient.allergies?.length && (
            <div>
              <p className="text-[11px] text-txt-muted mb-1 flex items-center gap-1">
                <AlertCircle size={12} className="text-red-400" /> Аллергии
              </p>
              <div className="flex flex-wrap gap-1">
                {patient.allergies.map((a) => (
                  <span key={a} className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px]">{a}</span>
                ))}
              </div>
            </div>
          )}
          {patient.notes && <p className="text-xs text-txt-secondary">{patient.notes}</p>}
          {patient.insurance && (
            <p className="text-[11px] text-txt-muted flex items-center gap-1">
              <Shield size={12} className="text-blue-400" /> {patient.insurance}
            </p>
          )}
        </GlassCard>
      )}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 mb-3">
        <User size={24} className="text-txt-muted" />
      </div>
      <h3 className="text-sm font-semibold text-txt-primary mb-1">{title}</h3>
      <p className="text-xs text-txt-muted max-w-[240px] leading-relaxed">{body}</p>
    </motion.div>
  )
}

function ScopeHint({
  icon, title, body, actionLabel, onAction,
}: {
  icon: ReactNode
  title: string
  body: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
      <GlassCard padding="md" className="text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-dv-gold/10">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-txt-primary">{title}</h3>
          <p className="text-xs text-txt-muted mt-1.5 leading-relaxed">{body}</p>
        </div>
        <Button size="sm" className="w-full" onClick={onAction}>{actionLabel}</Button>
      </GlassCard>
    </motion.div>
  )
}
