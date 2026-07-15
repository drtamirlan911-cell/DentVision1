import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Stethoscope,
  ShoppingCart,
  GraduationCap,
  BarChart3,
  Bot,
  Settings,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Shield,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Badge } from '@/components/ui/ds/Badge'

interface ServiceCard {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  route: string
  color: string
  gradient: string
  requiredPages: string[]
  stats?: { label: string; value: string }[]
}

const SERVICES: ServiceCard[] = [
  {
    id: 'crm',
    name: 'CRM',
    description: 'Расписание, пациенты, лечение, документы',
    icon: <Stethoscope size={24} />,
    route: '/crm/schedule',
    color: '#C9A96E',
    gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5',
    requiredPages: ['schedule', 'patients'],
    stats: [
      { label: 'Расписание', icon: '📅' },
      { label: 'Пациенты', icon: '👥' },
      { label: 'Документы', icon: '📄' },
    ],
  },
  {
    id: 'shop',
    name: 'DentVision Shop',
    description: 'Маркетплейс стоматологических товаров',
    icon: <ShoppingCart size={24} />,
    route: '/shop',
    color: '#3498DB',
    gradient: 'from-[#3498DB]/20 to-[#3498DB]/5',
    requiredPages: ['shop'],
    stats: [
      { label: 'Каталог', icon: '🛍️' },
      { label: 'Заказы', icon: '📦' },
      { label: 'Поставщики', icon: '🚚' },
    ],
  },
  {
    id: 'school',
    name: 'DentVision School',
    description: 'Образовательная платформа для врачей',
    icon: <GraduationCap size={24} />,
    route: '/school',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/20 to-[#27AE60]/5',
    requiredPages: ['school'],
    stats: [
      { label: 'Курсы', icon: '📚' },
      { label: 'Сертификаты', icon: '🎓' },
      { label: 'Клинические случаи', icon: '🏥' },
    ],
  },
  {
    id: 'ai',
    name: 'AI Помощник',
    description: 'Искусственный интеллект для диагностики',
    icon: <Bot size={24} />,
    route: '/ai',
    color: '#8E44AD',
    gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5',
    requiredPages: ['ai'],
    stats: [
      { label: 'Диагностика', icon: '🔍' },
      { label: 'Анализ', icon: '📊' },
    ],
  },
  {
    id: 'analytics',
    name: 'Аналитика',
    description: 'Отчёты и метрики клиники',
    icon: <BarChart3 size={24} />,
    route: '/analytics',
    color: '#E67E22',
    gradient: 'from-[#E67E22]/20 to-[#E67E22]/5',
    requiredPages: ['analytics'],
    stats: [
      { label: 'Отчёты', icon: '📈' },
      { label: 'Тренды', icon: '📊' },
    ],
  },
  {
    id: 'settings',
    name: 'Настройки',
    description: 'Управление клиникой и системой',
    icon: <Settings size={24} />,
    route: '/settings',
    color: '#95A5A6',
    gradient: 'from-[#95A5A6]/20 to-[#95A5A6]/5',
    requiredPages: ['settings'],
    stats: [
      { label: 'Клиника', icon: '🏥' },
      { label: 'Сотрудники', icon: '👥' },
    ],
  },
]

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  director: 'Руководитель',
  admin: 'Администратор',
  doctor: 'Врач',
  assistant: 'Ассистент',
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: '#8E44AD',
  director: '#C9A96E',
  admin: '#2980B9',
  doctor: '#27AE60',
  assistant: '#009688',
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function ServiceHub() {
  const navigate = useNavigate()
  const { user, clinic, roleInfo, logout } = useAuth()

  const allowedPages = roleInfo?.pages || []

  const visibleServices = SERVICES.filter((service) =>
    service.requiredPages.some((page) => allowedPages.includes(page))
  )

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/15">
              <Stethoscope size={20} className="text-dv-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-txt-primary tracking-tight">DentVision</h1>
              <p className="text-xs text-txt-muted">{clinic?.name || 'Платформа'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info */}
            <div className="flex items-center gap-2.5">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-txt-primary">{user?.name || user?.login}</p>
                <p className="text-xs font-medium" style={{ color: ROLE_COLORS[user?.role || ''] }}>
                  {ROLE_LABELS[user?.role || '']}
                </p>
              </div>
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
            </div>

            {/* Logout */}
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="h-8 px-3 rounded-lg text-sm text-txt-muted hover:text-error hover:bg-error/10 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Welcome section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 md:mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-txt-primary mb-2">
            Добро пожаловать, {user?.name?.split(' ')[0] || user?.login}
          </h2>
          <p className="text-txt-muted text-base md:text-lg">
            Выберите сервис для работы
          </p>
        </motion.div>

        {/* Services grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
        >
          {visibleServices.map((service) => (
            <motion.div key={service.id} variants={item}>
              <button
                onClick={() => navigate(service.route)}
                className={cn(
                  'group w-full text-left rounded-2xl border border-bdr-subtle',
                  'bg-surface-1 hover:bg-surface-2 transition-all duration-200',
                  'hover:border-bdr hover:shadow-lg hover:shadow-black/5',
                  'hover:-translate-y-0.5',
                  'focus:outline-none focus:ring-2 focus:ring-dv-gold/30'
                )}
              >
                <div className="p-5 md:p-6">
                  {/* Icon + Arrow */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                        `bg-gradient-to-br ${service.gradient}`
                      )}
                      style={{ color: service.color }}
                    >
                      {service.icon}
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-txt-ghost group-hover:text-txt-muted group-hover:translate-x-0.5 transition-all mt-1"
                    />
                  </div>

                  {/* Title + Description */}
                  <h3 className="text-base font-semibold text-txt-primary mb-1 group-hover:text-dv-gold transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-sm text-txt-muted mb-4 line-clamp-2">
                    {service.description}
                  </p>

                  {/* Stats pills */}
                  {service.stats && (
                    <div className="flex flex-wrap gap-2">
                      {service.stats.map((stat, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-3 text-xs text-txt-secondary"
                        >
                          <span>{stat.icon}</span>
                          <span>{stat.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>

        {/* Platform admin links (superadmin/director only) */}
        {(allowedPages.includes('admin') || allowedPages.includes('audit') || allowedPages.includes('backup')) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 md:mt-12"
          >
            <h3 className="text-sm font-semibold text-txt-ghost uppercase tracking-wider mb-4">
              Управление платформой
            </h3>
            <div className="flex flex-wrap gap-3">
              {allowedPages.includes('admin') && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-bdr-subtle bg-surface-1 hover:bg-surface-2 text-sm text-txt-secondary hover:text-txt-primary transition-all"
                >
                  <Shield size={16} />
                  Super Admin
                </button>
              )}
              {allowedPages.includes('audit') && (
                <button
                  onClick={() => navigate('/audit')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-bdr-subtle bg-surface-1 hover:bg-surface-2 text-sm text-txt-secondary hover:text-txt-primary transition-all"
                >
                  <FileText size={16} />
                  Аудит-журнал
                </button>
              )}
              {allowedPages.includes('backup') && (
                <button
                  onClick={() => navigate('/backup')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-bdr-subtle bg-surface-1 hover:bg-surface-2 text-sm text-txt-secondary hover:text-txt-primary transition-all"
                >
                  <Database size={16} />
                  Резервные копии
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div className="mt-12 md:mt-16 pb-8 text-center">
          <p className="text-xs text-txt-ghost">
            DentVision Platform v1.0 · {clinic?.plan || 'Starter'} plan
          </p>
        </div>
      </div>
    </div>
  )
}
