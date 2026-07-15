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
  Shield,
  Database,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/ds/Avatar'
import NotificationCenter from '@/components/NotificationCenter'
import * as api from '@/utils/api'

interface ServiceCard {
  id: string
  name: string
  enName: string
  description: string
  icon: React.ReactNode
  route: string
  color: string
  gradient: string
  requiredPages: string[]
  isPublic?: boolean
}

const SERVICES: ServiceCard[] = [
  {
    id: 'crm',
    name: 'CRM',
    enName: 'CRM',
    description: 'Расписание, пациенты, лечение, документы',
    icon: <Stethoscope size={24} />,
    route: '/crm/schedule',
    color: '#C9A96E',
    gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5',
    requiredPages: ['schedule', 'patients'],
  },
  {
    id: 'shop',
    name: 'Магазин',
    enName: 'DentVision Shop',
    description: 'Маркетплейс стоматологических товаров',
    icon: <ShoppingCart size={24} />,
    route: '/shop',
    color: '#3498DB',
    gradient: 'from-[#3498DB]/20 to-[#3498DB]/5',
    requiredPages: ['shop'],
    isPublic: true,
  },
  {
    id: 'school',
    name: 'Школа',
    enName: 'DentVision School',
    description: 'Образовательная платформа для врачей',
    icon: <GraduationCap size={24} />,
    route: '/school',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/20 to-[#27AE60]/5',
    requiredPages: ['school'],
    isPublic: true,
  },
  {
    id: 'ai',
    name: 'AI Помощник',
    enName: 'AI Assistant',
    description: 'Искусственный интеллект для диагностики',
    icon: <Bot size={24} />,
    route: '/ai',
    color: '#8E44AD',
    gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5',
    requiredPages: ['ai'],
  },
  {
    id: 'analytics',
    name: 'Аналитика',
    enName: 'Analytics',
    description: 'Отчёты и метрики клиники',
    icon: <BarChart3 size={24} />,
    route: '/analytics',
    color: '#E67E22',
    gradient: 'from-[#E67E22]/20 to-[#E67E22]/5',
    requiredPages: ['analytics'],
  },
  {
    id: 'settings',
    name: 'Настройки',
    enName: 'Settings',
    description: 'Управление клиникой и системой',
    icon: <Settings size={24} />,
    route: '/settings',
    color: '#95A5A6',
    gradient: 'from-[#95A5A6]/20 to-[#95A5A6]/5',
    requiredPages: ['settings'],
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
  const { user, clinic, roleInfo, isAuthenticated, logout } = useAuth()
  const [serviceAccess, setServiceAccess] = React.useState<Record<string, boolean> | null>(null)

  const allowedPages = roleInfo?.pages || []

  // Fetch service access for the clinic (controls which services are visible)
  React.useEffect(() => {
    let cancelled = false
    if (clinic?.id) {
      api.getServiceAccess(clinic.id)
        .then((data) => { if (!cancelled) setServiceAccess(data) })
        .catch(() => { if (!cancelled) setServiceAccess(null) })
    } else {
      setServiceAccess(null)
    }
    return () => { cancelled = true }
  }, [clinic?.id])

  const isServiceEnabled = (id: string): boolean => {
    if (!serviceAccess) return true // default: show all
    return serviceAccess[id] !== false
  }

  // Public services: always shown (Shop, School) — but respect clinic service toggle
  const publicServices = SERVICES.filter((s) => s.isPublic && isServiceEnabled(s.id))

  // Auth-gated services: only shown if authenticated + has matching pages + enabled
  const authServices = SERVICES.filter((s) =>
    !s.isPublic && isServiceEnabled(s.id) && s.requiredPages.some((page) => allowedPages.includes(page))
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
            {isAuthenticated && user ? (
              <>
                <NotificationCenter />
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-txt-primary">{user?.name || user?.login}</p>
                  <p className="text-xs font-medium" style={{ color: ROLE_COLORS[user?.role || ''] }}>
                    {ROLE_LABELS[user?.role || '']}
                  </p>
                </div>
                <Avatar name={user?.name || user?.login || '?'} size="sm" />
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="h-8 px-3 rounded-lg text-sm text-txt-muted hover:text-error hover:bg-error/10 transition-colors"
                >
                  Выйти
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="h-8 px-4 rounded-lg text-sm font-medium bg-dv-gold text-white hover:bg-dv-gold/90 transition-colors"
              >
                Войти в CRM
              </button>
            )}
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
            {isAuthenticated && user
              ? `Добро пожаловать, ${user?.name?.split(' ')[0] || user?.login}`
              : 'DentVision Platform'}
          </h2>
          <p className="text-txt-muted text-base md:text-lg">
            {isAuthenticated ? 'Выберите сервис для работы' : 'Образование и товары для стоматологов'}
          </p>
        </motion.div>

        {/* Public services (always shown) */}
        {publicServices.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-txt-ghost uppercase tracking-wider mb-4">
              {isAuthenticated ? 'Доступно всем' : 'Добро пожаловать'}
            </h3>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-8 md:mb-12"
            >
              {publicServices.map((service) => (
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
                      <h3 className="text-base font-semibold text-txt-primary mb-1 group-hover:text-dv-gold transition-colors">
                        {service.name}
                        <span className="ml-2 text-xs font-normal text-txt-ghost">{service.enName}</span>
                      </h3>
                      <p className="text-sm text-txt-muted line-clamp-2">
                        {service.description}
                      </p>
                    </div>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Auth-gated services (CRM, AI, Analytics, Settings) */}
        {isAuthenticated && authServices.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-txt-ghost uppercase tracking-wider mb-4">
              CRM и инструменты
            </h3>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
            >
              {authServices.map((service) => (
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
                      <h3 className="text-base font-semibold text-txt-primary mb-1 group-hover:text-dv-gold transition-colors">
                        {service.name}
                        <span className="ml-2 text-xs font-normal text-txt-ghost">{service.enName}</span>
                      </h3>
                      <p className="text-sm text-txt-muted line-clamp-2">
                        {service.description}
                      </p>
                    </div>
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Guest CTA: login for CRM */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 md:mt-12 text-center"
          >
            <div className="inline-flex flex-col items-center gap-3 p-6 rounded-2xl border border-bdr-subtle bg-surface-1">
              <p className="text-sm text-txt-muted">
                Есть клиника? Войдите в CRM для управления расписанием, пациентами и финансами.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="h-10 px-6 rounded-xl text-sm font-semibold bg-dv-gold text-white hover:bg-dv-gold/90 transition-colors"
              >
                Войти в CRM
              </button>
            </div>
          </motion.div>
        )}

        {/* Platform admin links (superadmin/director only) */}
        {isAuthenticated && (allowedPages.includes('admin') || allowedPages.includes('audit') || allowedPages.includes('backup')) && (
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
