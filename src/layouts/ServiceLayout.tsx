import React, { useState } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Stethoscope,
  ChevronLeft,
  X,
  LogOut,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useUIStore } from '@/stores/useUIStore'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Badge } from '@/components/ui/ds/Badge'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: string
}

interface ServiceLayoutProps {
  navItems: NavItem[]
  serviceName: string
  serviceColor: string
  serviceIcon: React.ReactNode
}

export function ServiceLayout({ navItems, serviceName, serviceColor, serviceIcon }: ServiceLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const [collapsed, setCollapsed] = useState(false)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const handleNavClick = (path: string) => {
    navigate(path)
    if (window.innerWidth < 768) toggleSidebar()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
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
        {/* Header with service branding */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-bdr-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${serviceColor}20`, color: serviceColor }}
            >
              {serviceIcon}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight truncate" style={{ color: serviceColor }}>
                  {serviceName}
                </h1>
                <p className="text-2xs text-txt-muted truncate max-w-[140px]">{clinic?.name || ''}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              {collapsed ? <ChevronLeft size={14} className="rotate-180" /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={toggleSidebar}
              className="md:hidden h-7 w-7 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Back to Hub */}
        {!collapsed && (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mx-3 mt-3 px-3 py-2 rounded-lg text-sm text-txt-muted hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
          >
            <LayoutGrid size={15} />
            Все сервисы
          </button>
        )}

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-bdr-subtle">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-txt-primary truncate">{user?.name || user?.login}</p>
                <p className="text-2xs text-txt-muted">{roleInfo?.label || 'Сотрудник'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'font-semibold'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
                style={isActive ? { backgroundColor: `${serviceColor}15`, color: serviceColor } : undefined}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="service-sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ backgroundColor: serviceColor }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <span
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? '' : 'text-txt-muted group-hover:text-txt-secondary'
                  )}
                  style={isActive ? { color: serviceColor } : undefined}
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="text-sm truncate">{item.label}</span>
                )}

                {item.badge && (
                  <Badge
                    variant={item.badge === 'gold' ? 'gold' : 'error'}
                    size="xs"
                    className={cn('ml-auto', collapsed && 'absolute -top-1 -right-1')}
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-bdr-subtle">
          <button
            onClick={() => { logout(); navigate('/login') }}
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

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 md:ml-[var(--dv-sidebar-width)]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-txt-primary">
              {navItems.find((item) => location.pathname.startsWith(item.path))?.label || serviceName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <LayoutGrid size={14} />
              Платформа
            </button>
            <div className="relative">
              <Avatar name={user?.name || user?.login || '?'} size="xs" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter p-4 md:p-6 pb-20 md:pb-6">
            <Outlet context={{ user, clinic, roleInfo }} />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav for this service */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-surface-1/80 backdrop-blur-xl border-t border-bdr-subtle">
          <div className="flex items-center justify-around h-14 px-2">
            {navItems.slice(0, 5).map((item) => {
              const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
                >
                  <div
                    className={cn(
                      'relative flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200',
                      active ? '' : 'text-txt-muted'
                    )}
                    style={active ? { color: serviceColor } : undefined}
                  >
                    {active && (
                      <motion.div
                        layoutId="service-bottomnav-indicator"
                        className="absolute inset-0 rounded-xl"
                        style={{ backgroundColor: `${serviceColor}15` }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.icon}</span>
                  </div>
                  <span
                    className={cn(
                      'text-2xs font-medium transition-colors',
                      active ? '' : 'text-txt-muted'
                    )}
                    style={active ? { color: serviceColor } : undefined}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </nav>
    </div>
  )
}
