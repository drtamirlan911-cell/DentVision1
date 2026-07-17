import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, Phone, Calendar, FileText, Plus, Receipt, ScanLine, 
  Activity, Clock, Users, X, Eye, Edit, Trash2, 
  Stethoscope, Pill, Heart, Shield, Brain, 
  ArrowUpRight, MessageSquare, Mail, MapPin,
  CalendarDays, Clock10, CreditCard, FilePlus,
  Search, Settings, AlertCircle, Bell, Zap, CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { usePatientStore } from '@/store/patient.store'
import { useAuth } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import { useAIExecutor } from '@/utils/aiExecutor'

const TREATMENT_STAGES = [
  { id: 'diagnosis', label: 'Диагностика', icon: Search, color: 'text-blue-400' },
  { id: 'planning', label: 'Планирование', icon: FilePlus, color: 'text-purple-400' },
  { id: 'treatment', label: 'Лечение', icon: Stethoscope, color: 'text-green-400' },
  { id: 'control', label: 'Контроль', icon: Shield, color: 'text-amber-400' },
  { id: 'maintenance', label: 'Поддержание', icon: Heart, color: 'text-rose-400' },
]

interface StageNodeProps {
  stage: typeof TREATMENT_STAGES[number]
  index: number
  isCurrent: boolean
  isCompleted: boolean
}

function StageNode({ stage, index, isCurrent, isCompleted }: StageNodeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 + index * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
      className="flex flex-col items-center gap-1.5"
    >
      <motion.div
        whileHover={{ scale: 1.15 }}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-300',
          isCurrent
            ? 'bg-white/10 border-dv-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]'
            : isCompleted
            ? 'bg-green-500/20 border-green-500'
            : 'bg-white/5 border-white/10'
        )}
      >
        {isCompleted ? (
          <CheckCircle size={16} className="text-green-400" />
        ) : (
          <stage.icon size={16} className={cn(isCurrent ? stage.color : 'text-txt-muted')} />
        )}
      </motion.div>
      <span className={cn(
        'text-[10px] font-medium text-center mt-1.5 max-w-[60px]',
        isCurrent ? stage.color : isCompleted ? 'text-green-400' : 'text-txt-muted'
      )}>
        {stage.label}
      </span>
      {index < TREATMENT_STAGES.length - 1 && (
        <motion.div
          className="absolute left-1/2 top-5 w-[calc(100%+8px)] h-0.5 -translate-x-1/2"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.25 + index * 0.08, type: 'spring', stiffness: 400, damping: 25 }}
          style={{ transformOrigin: 'left center' }}
        >
          <div className={cn(
            'h-full rounded',
            isCompleted ? 'bg-green-500' : 'bg-white/10'
          )} />
        </motion.div>
      )}
    </motion.div>
  )
}

interface PatientContextData {
  id: string
  name: string
  phone?: string
  email?: string
  birthDate?: string
  lastVisit?: string
  nextVisit?: string
  treatmentStage?: string
  debt?: number
  avatar?: string
  notes?: string
  allergies?: string[]
  insurance?: string
  address?: string
}

const MOCK_PATIENT: PatientContextData = {
  id: 'patient-1',
  name: 'Иванов Иван Иванович',
  phone: '+7 (999) 123-45-67',
  email: 'ivanov@example.com',
  birthDate: '1985-03-15',
  lastVisit: '2026-06-15',
  nextVisit: '2026-07-20',
  treatmentStage: 'treatment',
  debt: 15000,
  notes: 'Аллергия на прокаин. Предпочитает утренние записи.',
  allergies: ['Прокаин', 'Латекс'],
  insurance: 'Росгосстрах — полис № 7729104567',
  address: 'г. Алматы, ул. Абая 150, кв. 42',
}

export function ContextTab() {
  const { user } = useAuth()
  const selectedPatient = usePatientStore((s) => s.selectedPatient)
  const patientData = usePatientStore((s) => s.patientData)
  const { executeAction } = useAIExecutor()

  const patient = selectedPatient || patientData || MOCK_PATIENT
  const currentStage = TREATMENT_STAGES.find(s => s.id === patient.treatmentStage) || TREATMENT_STAGES[2]

  return (
    <div className="space-y-4 p-4">
      {/* Patient Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <GlassCard padding="md" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-dv-gold/5 to-transparent" />
          
          <div className="relative flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-dv-gold/20 to-dv-gold/5 border border-dv-gold/20 flex items-center justify-center">
                {patient.avatar ? (
                  <img src={patient.avatar} alt={patient.name} className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <User size={28} className="text-dv-gold" />
                )}
              </div>
              {patient.debt && patient.debt > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold"
                >
                  <CreditCard size={10} />
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-base font-semibold text-txt-primary truncate">{patient.name}</h3>
                <Badge variant="outline" className={cn('text-xs', currentStage.color)}>
                  <currentStage.icon size={10} className="mr-1" />
                  {currentStage.label}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-txt-muted">
                {patient.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} />
                    {patient.phone}
                  </span>
                )}
                {patient.nextVisit && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} />
                    След. визит: {formatDate(patient.nextVisit)}
                  </span>
                )}
                {patient.debt !== undefined && patient.debt > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <CreditCard size={11} />
                    Долг: {patient.debt.toLocaleString('ru-RU')} ₸
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/10"
          >
            <div className="text-center p-2 rounded-xl bg-white/[0.03]">
              <div className="text-lg font-bold text-txt-primary">24</div>
              <div className="text-[10px] text-txt-muted">Визитов</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/[0.03]">
              <div className="text-lg font-bold text-txt-primary">8</div>
              <div className="text-[10px] text-txt-muted">Лечений</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/[0.03]">
              <div className="text-lg font-bold text-txt-primary">156 000</div>
              <div className="text-[10px] text-txt-muted">₸ Объем</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-white/[0.03]">
              <div className="text-lg font-bold text-dv-gold">4.9</div>
              <div className="text-[10px] text-txt-muted">Рейтинг</div>
            </div>
          </motion.div>
        </GlassCard>
        </motion.div>

        {/* Treatment Progress */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mt-3"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
              <Activity size={14} className="text-dv-gold" />
              Этапы лечения
            </h4>
          </div>
          <div className="relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-full bg-white/10" />
            <div className="flex items-center justify-between relative z-10">
              {TREATMENT_STAGES.map((stage, i) => (
                <StageNode
                  key={stage.id}
                  stage={stage}
                  index={i}
                  isCurrent={stage.id === currentStage.id}
                  isCompleted={TREATMENT_STAGES.indexOf(stage) < TREATMENT_STAGES.indexOf(currentStage)}
                />
              ))}
            </div>
            </div>
          </motion.div>

        {/* Quick Actions Grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <h4 className="text-sm font-semibold text-txt-primary mb-3 flex items-center gap-1.5">
          <Zap size={14} className="text-dv-gold" />
          Быстрые действия
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Карта', icon: FileText, action: 'OpenMedicalCard', color: 'text-blue-400' },
            { label: 'КТ/Снимки', icon: ScanLine, action: 'OpenDocuments', color: 'text-purple-400' },
            { label: 'План', icon: FilePlus, action: 'OpenMedicalCard', color: 'text-green-400' },
            { label: 'Оплата', icon: CreditCard, action: 'OpenCashier', color: 'text-amber-400' },
            { label: 'Назначить', icon: CalendarDays, action: 'OpenSchedule', color: 'text-blue-400' },
            { label: 'Напомнить', icon: Bell, action: 'CreateAppointment', color: 'text-rose-400' },
            { label: 'Лаборатория', icon: Pill, action: 'OpenLab', color: 'text-orange-400' },
            { label: 'История', icon: Clock10, action: 'OpenVisits', color: 'text-cyan-400' },
            { label: 'Чат', icon: MessageSquare, action: 'OpenChat', color: 'text-dv-gold' },
          ].map((item, i) => (
            <motion.button
              key={item.action}
              onClick={() => executeAction({
                id: `quick-${item.action}`,
                type: item.action,
                label: item.label,
                confidence: 1,
                requiresConfirmation: false,
              })}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
              className="relative p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-dv-gold/30 transition-all duration-200 flex flex-col items-center gap-2 group"
            >
              <div className={cn('p-2 rounded-lg transition-colors', item.color)}>
                <item.icon size={18} />
              </div>
              <span className="text-[11px] font-medium text-txt-secondary">{item.label}</span>
              <motion.div
                animate={{ opacity: [0, 1, 0], y: [4, 0, -4] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-dv-gold/50 group-hover:opacity-100 opacity-0 transition-opacity"
              />
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Treatment History */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
      >
        <GlassCard padding="md">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
              <Activity size={14} className="text-dv-gold" />
              История лечения
            </h4>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-xs text-dv-gold hover:text-dv-gold/70 flex items-center gap-1"
            >
              <ArrowUpRight size={12} />
              Все записи
            </motion.button>
          </div>
          <div className="space-y-0">
            {[
              { date: '2026-06-15', procedure: 'Лечение кариеса 2.6', doctor: 'Иванова А.С.', cost: '15 000 ₸', status: 'completed' },
              { date: '2026-05-20', procedure: 'Профессиональная гигиена', doctor: 'Иванова А.С.', cost: '8 000 ₸', status: 'completed' },
              { date: '2026-04-10', procedure: 'Пломбирование 3.5', doctor: 'Петров В.К.', cost: '12 000 ₸', status: 'completed' },
              { date: '2026-07-20', procedure: 'Контрольный осмотр + КТ', doctor: 'Иванова А.С.', cost: '—', status: 'scheduled' },
            ].map((tx, i) => (
              <motion.div
                key={tx.date + tx.procedure}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  i !== 3 && 'border-b border-bdr-subtle'
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  tx.status === 'scheduled' ? 'bg-amber-500/20' : 'bg-surface-2'
                )}>
                  {tx.status === 'scheduled' ? (
                    <CalendarDays size={14} className="text-amber-400" />
                  ) : (
                    <CheckCircle size={14} className="text-green-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{tx.procedure}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-2xs text-txt-muted">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={10} />
                      {tx.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      {tx.doctor}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-sm font-semibold',
                    tx.status === 'scheduled' ? 'text-amber-400' : 'text-txt-primary'
                  )}>
                    {tx.cost}
                  </p>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    tx.status === 'scheduled' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-green-500/20 text-green-400'
                  )}>
                    {tx.status === 'scheduled' ? 'Запланировано' : 'Выполнено'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* Allergies & Notes */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="grid grid-cols-2 gap-3"
      >
        {patient.allergies?.length && (
          <GlassCard padding="md">
            <h4 className="text-sm font-semibold text-txt-primary mb-2 flex items-center gap-1.5">
              <AlertCircle size={13} className="text-red-400" />
              Аллергии
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {patient.allergies?.map((allergy: string, i: number) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                  className="px-2 py-1 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium"
                >
                  {allergy}
                </motion.span>
              ))}
            </div>
          </GlassCard>
        )}
        {patient.insurance && (
          <GlassCard padding="md">
            <h4 className="text-sm font-semibold text-txt-primary mb-2 flex items-center gap-1.5">
              <Shield size={13} className="text-blue-400" />
              Страховка
            </h4>
            <p className="text-sm text-txt-secondary">{patient.insurance}</p>
          </GlassCard>
        )}
      </motion.div>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-full py-12 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 mb-4">
        <User size={28} className="text-txt-muted" />
      </div>
      <h3 className="text-base font-semibold text-txt-primary mb-1">Пациент не выбран</h3>
      <p className="text-sm text-txt-muted max-w-xs">Выберите пациента в CRM, чтобы увидеть контекст</p>
    </motion.div>
  )
}