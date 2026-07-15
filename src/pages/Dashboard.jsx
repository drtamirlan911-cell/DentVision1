import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Stethoscope,
  ShoppingCart,
  GraduationCap,
  Bot,
  BarChart3,
  FlaskConical,
  Package,
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
import { StatCard } from '@/components/ui/ds/StatCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/hooks/useData'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

const SERVICE_TILES = [
  {
    id: 'crm',
    title: 'CRM',
    subtitle: 'Пациенты и расписание',
    icon: <Stethoscope size={22} />,
    path: '/crm/schedule',
    color: '#C9A96E',
    gradient: 'from-[#C9A96E]/15 to-[#C9A96E]/5',
  },
  {
    id: 'shop',
    title: 'Shop',
    subtitle: 'Маркетплейс товаров',
    icon: <ShoppingCart size={22} />,
    path: '/shop',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/15 to-[#27AE60]/5',
  },
  {
    id: 'school',
    title: 'School',
    subtitle: 'Образовательная платформа',
    icon: <GraduationCap size={22} />,
    path: '/school',
    color: '#2980B9',
    gradient: 'from-[#2980B9]/15 to-[#2980B9]/5',
  },
  {
    id: 'ai',
    title: 'AI Assistant',
    subtitle: 'ИИ-помощник врача',
    icon: <Bot size={22} />,
    path: '/ai',
    color: '#8E44AD',
    gradient: 'from-[#8E44AD]/15 to-[#8E44AD]/5',
  },
  {
    id: 'analytics',
    title: 'Аналитика',
    subtitle: 'Отчёты и метрики',
    icon: <BarChart3 size={22} />,
    path: '/analytics',
    color: '#F39C12',
    gradient: 'from-[#F39C12]/15 to-[#F39C12]/5',
  },
  {
    id: 'lab',
    title: 'Лаборатория',
    subtitle: 'Лабораторные заказы',
    icon: <FlaskConical size={22} />,
    path: '/crm/lab',
    color: '#00BCD4',
    gradient: 'from-[#00BCD4]/15 to-[#00BCD4]/5',
  },
  {
    id: 'cashier',
    title: 'Финансы',
    subtitle: 'Доходы и расходы',
    icon: <CreditCard size={22} />,
    path: '/crm/cashier',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/15 to-[#27AE60]/5',
  },
  {
    id: 'settings',
    title: 'Настройки',
    subtitle: 'Конфигурация системы',
    icon: <Settings size={22} />,
    path: '/settings',
    color: '#64748B',
    gradient: 'from-[#64748B]/15 to-[#64748B]/5',
  },
]

function QuickStats({ data }) {
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppts = (data.appointments || []).filter((a) => a.date === today)
    const totalRevenue = (data.receipts || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const activePatients = (data.patients || []).length
    const todayCount = todayAppts.length
    return { todayCount, totalRevenue, activePatients }
  }, [data])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        label="Доход"
        value={formatMoney(stats.totalRevenue)}
        icon={<DollarSign size={18} />}
      />
      <StatCard
        label="Загрузка кресел"
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
              'relative overflow-hidden rounded-xl border border-bdr-subtle p-4 text-left',
              'bg-gradient-to-br',
              tile.gradient,
              'hover:border-bdr/50 transition-all duration-200 group'
            )}
          >
            {/* Icon */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl mb-3 transition-transform duration-200 group-hover:scale-110"
              style={{ background: `${tile.color}20`, color: tile.color }}
            >
              {tile.icon}
            </div>

            {/* Text */}
            <h4 className="text-sm font-semibold text-txt-primary mb-0.5">{tile.title}</h4>
            <p className="text-2xs text-txt-muted line-clamp-2">{tile.subtitle}</p>

            {/* Arrow */}
            <ArrowRight
              size={14}
              className="absolute right-3 top-3 text-txt-ghost opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
              style={{ color: tile.color }}
            />
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function UpcomingAppointments({ data }) {
  const today = new Date().toISOString().split('T')[0]
  const appointments = (data.appointments || [])
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .slice(0, 5)

  const patients = data.patients || []

  if (appointments.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} className="text-dv-gold" />
          Ближайшие записи
        </CardTitle>
        <button
          onClick={() => {}}
          className="text-xs text-dv-gold hover:text-dv-gold-light transition-colors"
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
      <div className="flex gap-2">
        {actions.map((action) => (
          <motion.button
            key={action.label}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-bdr-subtle text-txt-secondary text-sm hover:bg-surface-raised-hover hover:border-bdr/50 hover:text-txt-primary transition-all duration-200"
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
  const data = useData(user?.clinicId)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Greeting */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-txt-primary">
            {getGreeting()}, {user?.name || user?.login}
          </h1>
          <p className="text-sm text-txt-secondary mt-1">
            {new Date().toLocaleDateString('ru-RU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dv-gold/10 border border-dv-gold/20">
            <Sparkles size={14} className="text-dv-gold" />
            <span className="text-xs font-medium text-dv-gold">AI включён</span>
          </div>
        </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={item}>
          <UpcomingAppointments data={data} />
        </motion.div>
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={16} className="text-dv-gold" />
                Активность
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-txt-secondary">Записей на этой неделе</span>
                  <span className="font-semibold text-txt-primary">
                    {(data.appointments || []).filter((a) => {
                      const d = new Date(a.date)
                      const now = new Date()
                      const weekAgo = new Date(now.getTime() - 7 * 86400000)
                      return d >= weekAgo && d <= now
                    }).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-txt-secondary">Новых пациентов</span>
                  <span className="font-semibold text-txt-primary">
                    {(data.patients || []).filter((p) => {
                      const created = new Date(p.createdAt || p.created_at || Date.now())
                      const weekAgo = new Date(Date.now() - 7 * 86400000)
                      return created >= weekAgo
                    }).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-txt-secondary">Документов подписано</span>
                  <span className="font-semibold text-txt-primary">
                    {(data.documents || []).filter((d) => d.status === 'signed').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <QuickActions />
      </motion.div>
    </motion.div>
  )
}
