import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import {
  Calendar,
  Users,
  DollarSign,
  Stethoscope,
  ShoppingCart,
  GraduationCap,
  Bot,
  BarChart3,
  FlaskConical,
  Settings,
  ArrowRight,
  Clock,
  Activity,
  Sparkles,
  CreditCard,
  FileText,
} from 'lucide-react'
import { cn, getGreeting, formatMoney } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard'
import { Badge } from '@/components/ui/ds/Badge'

import { useAuth } from '@/store/auth.store'
import { useDataQuery } from '@/queries/useDataQuery'


const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
} as Variants

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
} as Variants

const SERVICE_TILES = [
  {
    id: 'crm',
    title: 'CRM',
    subtitle: 'Пациенты и расписание',
    icon: <Stethoscope size={22} />,
    path: '/crm/schedule',
  },
  {
    id: 'shop',
    title: 'Shop',
    subtitle: 'Маркетплейс товаров',
    icon: <ShoppingCart size={22} />,
    path: '/shop',
  },
  {
    id: 'school',
    title: 'School',
    subtitle: 'Образовательная платформа',
    icon: <GraduationCap size={22} />,
    path: '/school',
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    subtitle: 'ИИ-помощник врача',
    icon: <Bot size={22} />,
    path: '/',
  },
  {
    id: 'analytics',
    title: 'Аналитика',
    subtitle: 'Отчёты и метрики',
    icon: <BarChart3 size={22} />,
    path: '/analytics',
  },
  {
    id: 'lab',
    title: 'Лаборатория',
    subtitle: 'Лабораторные заказы',
    icon: <FlaskConical size={22} />,
    path: '/crm/lab',
  },
  {
    id: 'cashier',
    title: 'Финансы',
    subtitle: 'Доходы и расходы',
    icon: <CreditCard size={22} />,
    path: '/crm/cashier',
  },
  {
    id: 'settings',
    title: 'Настройки',
    subtitle: 'Конфигурация системы',
    icon: <Settings size={22} />,
    path: '/settings',
  },
]

function QuickStats({ data }: { data: ReturnType<typeof useDataQuery> }) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppts = (data.appointments || []).filter((a) => a.date === today)
    // Today's revenue only — not the all-time sum, so the tile reflects the current day.
    const todayRevenue = (data.receipts || [])
      .filter((r) => String((r as { date?: string }).date || '').slice(0, 10) === today)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const activePatients = (data.patients || []).length
    const todayCount = todayAppts.length
    return { todayCount, todayRevenue, activePatients }
  }, [data])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Записей сегодня"
        value={stats.todayCount}
        icon={<Calendar size={18} />}
      />
      <StatCard
        label="Пациентов"
        value={stats.activePatients}
        icon={<Users size={18} />}
      />
      <StatCard
        label="Доход сегодня"
        value={formatMoney(stats.todayRevenue)}
        icon={<DollarSign size={18} />}
      />
      <StatCard
        label="Загрузка (оц.)"
        value={`${Math.min(100, Math.round((stats.todayCount / 8) * 100))}%`}
        icon={<Activity size={18} />}
      />
    </div>
  )
}

function ServiceGrid() {
  const navigate = useNavigate()

  return (
    <div>
      <h3 className="text-sm font-semibold text-txt-secondary mb-3 px-1">Сервисы</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SERVICE_TILES.map((tile) => (
          <motion.button
            key={tile.id}
            variants={item}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(tile.path)}
            className={cn(
              'relative overflow-hidden rounded-xl border border-bdr-subtle p-4 text-left min-h-11',
              'bg-gradient-to-br from-dv-gold/10 to-transparent',
              'hover:border-bdr/50 transition-all duration-200 group'
            )}
          >
            {/* Icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3 bg-dv-gold/10 text-dv-gold transition-transform duration-200 group-hover:scale-110">
              {tile.icon}
            </div>

            {/* Text */}
            <h4 className="text-sm font-semibold text-txt-primary mb-0.5">{tile.title}</h4>
            <p className="text-2xs text-txt-muted line-clamp-2">{tile.subtitle}</p>

            {/* Arrow */}
            <ArrowRight
              size={14}
              className="absolute right-3 top-3 text-dv-gold opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
            />
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function UpcomingAppointments({ data }: { data: ReturnType<typeof useDataQuery> }) {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const appointments = (data.appointments || [])
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .slice(0, 5)

  const patients = data.patients || []

  if (appointments.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} className="text-dv-gold" />
          Ближайшие записи
        </CardTitle>
        <button
          onClick={() => navigate('/crm/schedule')}
          className="text-xs text-dv-gold hover:text-dv-gold-light transition-colors min-h-11"
        >
          Все записи
        </button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {appointments.map((appt) => {
            const patient = patients.find((p) => p.id === appt.patientId)
            return (
              <div
                key={appt.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-surface-2/50 hover:bg-surface-2 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold text-xs font-bold shrink-0">
                  {appt.time?.slice(0, 5) || '--:--'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-txt-primary truncate">
                    {patient?.name || appt.patientName || 'Пациент'}
                  </p>
                  <p className="text-2xs text-txt-muted truncate">
                    {appt.service || 'Приём'}
                  </p>
                </div>
                <Badge
                  variant={
                    appt.status === 'confirmed' ? 'success'
                      : appt.status === 'cancelled' ? 'error'
                      : 'warning'
                  }
                  size="xs"
                >
                  {appt.status === 'confirmed' ? 'Подтверждена'
                    : appt.status === 'cancelled' ? 'Отменена'
                    : 'Ожидание'}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Новый пациент', icon: <Users size={16} />, path: '/crm/patients' },
    { label: 'Запись', icon: <Calendar size={16} />, path: '/crm/schedule' },
    { label: 'Документ', icon: <FileText size={16} />, path: '/crm/documents' },
    { label: 'Аналитика', icon: <BarChart3 size={16} />, path: '/analytics' },
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-txt-secondary mb-3 px-1">Быстрые действия</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <motion.button
            key={action.label}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-bdr-subtle text-txt-secondary text-sm hover:bg-surface-raised-hover hover:border-bdr/50 hover:text-txt-primary transition-all duration-200 min-h-11"
          >
            <span className="text-txt-muted">{action.icon}</span>
            {action.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const data = useDataQuery(user?.clinicId)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-full overflow-x-hidden mx-auto space-y-6"
    >
      {/* Greeting */}
      <motion.div variants={item}>
        <PageHeader
          title={`${getGreeting()}, ${user?.name || user?.login}`}
          subtitle={new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          actions={
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dv-gold/10 border border-dv-gold/20">
              <Sparkles size={14} className="text-dv-gold" />
              <span className="text-xs font-medium text-dv-gold">AI включён</span>
            </div>
          }
        />
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={item}>
        <QuickStats data={data} />
      </motion.div>

      {/* Service Grid */}
      <motion.div variants={item}>
        <ServiceGrid />
      </motion.div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4">
        <motion.div variants={item}>
          <UpcomingAppointments data={data} />
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <QuickActions />
      </motion.div>
    </motion.div>
  )
}
