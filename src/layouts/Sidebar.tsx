import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  FileText,
  FlaskConical,
  Bot,
  UserCog,
  Settings,
  LogOut,
  X,
  Megaphone,
  Package,
  Stethoscope,
  BookOpen,
  ClipboardList,
  Shield,
  Database,
  ShoppingBag,
  GraduationCap,
  BarChart3,
  Bell,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Badge } from '@/components/ui/ds/Badge'
import { Separator } from '@/components/ui/ds/Misc'
import { useAuth } from '@/context/AuthContext'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'services',
    label: 'Сервисы',
    items: [
      { id: 'dashboard', label: 'Главная', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
      { id: 'schedule', label: 'Расписание', icon: <Calendar size={18} />, path: '/schedule' },
      { id: 'patients', label: 'Пациенты', icon: <Users size={18} />, path: '/patients' },
      { id: 'medical-card', label: 'Мед. карты', icon: <Stethoscope size={18} />, path: '/medical-card' },
      { id: 'visits', label: 'Журнал посещений', icon: <ClipboardList size={18} />, path: '/visits' },
      { id: 'icd10', label: 'МКБ-10', icon: <BookOpen size={18} />, path: '/icd10' },
      { id: 'documents', label: 'Документы', icon: <FileText size={18} />, path: '/documents' },
    ],
  },
  {
    id: 'business',
    label: 'Бизнес',
    items: [
      { id: 'cashier', label: 'Финансы', icon: <DollarSign size={18} />, path: '/cashier' },
      { id: 'pricelist', label: 'Прайс-лист', icon: <FileText size={18} />, path: '/pricelist' },
      { id: 'lab', label: 'Лаборатория', icon: <FlaskConical size={18} />, path: '/lab' },
      { id: 'inventory', label: 'Склад', icon: <Package size={18} />, path: '/inventory' },
      { id: 'promotions', label: 'Акции', icon: <Megaphone size={18} />, path: '/promotions' },
      { id: 'staff', label: 'Сотрудники', icon: <UserCog size={18} />, path: '/staff' },
    ],
  },
  {
    id: 'platform',
    label: 'Платформа',
    items: [
      { id: 'shop', label: 'DentVision Shop', icon: <ShoppingBag size={18} />, path: '/shop' },
      { id: 'school', label: 'DentVision School', icon: <GraduationCap size={18} />, path: '/school' },
      { id: 'ai', label: 'AI Помощник', icon: <Bot size={18} />, path: '/ai' },
      { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} />, path: '/analytics' },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    items: [
      { id: 'audit', label: 'Аудит-журнал', icon: <Shield size={18} />, path: '/audit' },
      { id: 'backup', label: 'Резерв. копии', icon: <Database size={18} />, path: '/backup' },
      { id: 'admin', label: 'Super Admin', icon: <Settings size={18} />, path: '/admin' },
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

interface SidebarProps {
  allowedPages: string[]
  onLogout: () => void
}

export function Sidebar({ allowedPages, onLogout }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode } = useUIStore()
  const { user, clinic } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const roleColor = ROLE_COLORS[user?.role || ''] || '#C9A96E'

  const filteredGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedPages.includes(item.id)),
    }))
    .filter((group) => group.items.length > 0)

  const totalItems = filteredGroups.reduce((acc, g) => acc + g.items.length, 0)

  const handleNavClick = (path: string) => {
    navigate(path)
    if (window.innerWidth < 768) toggleSidebar()
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 'var(--dv-sidebar-collapsed)' : 'var(--dv-sidebar-width)',
          x: window.innerWidth < 768 ? (sidebarOpen ? 0 : -280) : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'bg-surface-1 border-r border-bdr-subtle',
          'md:translate-x-0',
          'max-md:shadow-2xl',
        )}
        style={{ width: collapsed ? 'var(--dv-sidebar-collapsed)' : 'var(--dv-sidebar-width)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-bdr-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/15">
              <Stethoscope size={16} className="text-dv-gold" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-dv-gold tracking-tight truncate">DentVision</h1>
                <p className="text-2xs text-txt-muted truncate max-w-[140px]">{clinic?.name || 'CRM'}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={toggleSidebar}
              className="md:hidden h-7 w-7 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-bdr-subtle">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-txt-primary truncate">{user?.name || user?.login}</p>
                <p className="text-2xs font-medium" style={{ color: roleColor }}>
                  {ROLE_LABELS[user?.role || ''] || 'Сотрудник'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar">
          {filteredGroups.map((group) => (
            <div key={group.id}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-txt-ghost">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive =
                  item.path === '/app/dashboard'
                    ? location.pathname === '/app/dashboard'
                    : location.pathname.startsWith(item.path)

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150 mb-0.5',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                      isActive
                        ? 'bg-dv-gold/10 text-dv-gold font-semibold'
                        : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-dv-gold"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}

                    <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted group-hover:text-txt-secondary')}>
                      {item.icon}
                    </span>

                    {!collapsed && (
                      <span className="text-sm truncate">{item.label}</span>
                    )}

                    {item.badge && (
                      <Badge variant="error" size="xs" className={cn('ml-auto', collapsed && 'absolute -top-1 -right-1')}>
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-bdr-subtle space-y-2">
          {!collapsed && clinic && (
            <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 mb-2">
              <span className="text-2xs text-txt-muted">Тариф</span>
              <Badge variant="gold" size="xs">{clinic.plan || 'Starter'}</Badge>
            </div>
          )}

          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
            <button
              onClick={toggleDarkMode}
              className={cn(
                'flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors',
                collapsed ? 'h-8 w-8' : 'h-8 w-8'
              )}
              title="Тёмная тема"
            >
              {darkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={onLogout}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
            title="Выйти из системы"
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </button>
        </div>
      </motion.aside>
    </>
  )
}

export { NAV_GROUPS }
export type { NavItem, NavGroup }
