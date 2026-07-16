import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Stethoscope, ChevronLeft, ChevronRight, LogOut, Menu, Brain, Bell,
  ShoppingCart, GraduationCap, Briefcase, BarChart3, Users, User,
  Shield, FileText, Database, Settings, Bot, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { Badge } from '@/components/ui/ds/Badge';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { aiProactive } from '@/utils/api';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string | number;
  color?: string;
  section?: 'services' | 'platform';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={16} />, path: '/crm/schedule', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={16} />, path: '/shop', color: '#8E44AD', section: 'services' },
  { id: 'school', label: 'Академия', icon: <GraduationCap size={16} />, path: '/school', color: '#16A085', section: 'services' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={16} />, path: '/analytics', color: '#F39C12', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={16} />, path: '/jobs', color: '#E67E22', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={16} />, path: '/community', color: '#00BCD4', section: 'services' },
  { id: 'ai', label: 'AI Команда', icon: <Bot size={16} />, path: '/ai', color: '#8E44AD', section: 'platform' },
  { id: 'profile', label: 'Профиль', icon: <User size={16} />, path: '/profile', color: '#2980B9', section: 'platform' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={16} />, path: '/settings', color: '#64748B', section: 'platform' },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: 'admin', label: 'Платформа', icon: <Shield size={16} />, path: '/admin', color: '#E74C3C', section: 'platform' },
  { id: 'audit', label: 'Аудит', icon: <FileText size={16} />, path: '/audit', color: '#F39C12', section: 'platform' },
  { id: 'backup', label: 'Бэкапы', icon: <Database size={16} />, path: '/backup', color: '#00BCD4', section: 'platform' },
];

export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, contextSheetOpen, setContextSheetOpen } = useUIStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return !sessionStorage.getItem('dv_welcomed'); } catch { return false; }
  });
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) setContextSheetOpen(false);
  }, [isMobile, setContextSheetOpen]);

  const handleWelcomeComplete = useCallback(() => {
    try { sessionStorage.setItem('dv_welcomed', '1'); } catch {}
    setShowWelcome(false);
    setSidebarVisible(true);
    setTimeout(() => fetchProactiveAlerts(), 500);
  }, []);

  const fetchProactiveAlerts = useCallback(async () => {
    try {
      const data = await aiProactive();
      if (data?.alerts?.length) setProactiveAlerts(data.alerts);
    } catch {}
  }, []);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const allowedPages = roleInfo?.pages || [];
  const isAdmin = allowedPages.includes('admin');

  const serviceItems = NAV_ITEMS.filter(item => {
    if (item.section === 'platform' && item.id === 'ai') return true;
    if (item.section === 'platform') return true;
    if (item.id === 'crm') return allowedPages.some(p => p === 'schedule' || p === 'patients');
    if (item.id === 'shop') return allowedPages.includes('shop');
    if (item.id === 'school') return allowedPages.includes('school');
    if (item.id === 'analytics') return true;
    if (item.id === 'jobs') return true;
    if (item.id === 'community') return true;
    return true;
  });

  const activeItem = [...NAV_ITEMS, ...ADMIN_ITEMS].find(
    item => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  const getPageTitle = () => {
    if (location.pathname === '/') return 'DentVision Intelligence';
    if (location.pathname.startsWith('/crm')) return 'CRM';
    if (location.pathname.startsWith('/shop')) return 'Маркетплейс';
    if (location.pathname.startsWith('/school')) return 'Академия';
    return activeItem?.label || 'DentVision';
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile && sidebarOpen) toggleSidebar();
  };

  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex">
      {/* ─── Mobile Sidebar Overlay ─── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ─── */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarWidth,
          x: isMobile ? (sidebarOpen ? 0 : -sidebarWidth) : 0,
          opacity: sidebarVisible ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'h-full flex flex-col bg-surface-1 border-r border-bdr-subtle flex-shrink-0 z-50',
          isMobile && 'fixed top-0 left-0 bottom-0'
        )}
        style={{ width: sidebarWidth }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-bdr-subtle flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/15">
              <Stethoscope size={16} className="text-dv-gold" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-dv-gold tracking-tight truncate">DentVision</h1>
                <p className="text-2xs text-txt-muted truncate max-w-[140px]">Intelligence</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2.5 border-b border-bdr-subtle flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-txt-primary truncate">{user?.name || user?.login}</p>
                <p className="text-2xs text-txt-muted">{roleInfo?.label || 'Сотрудник'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Intelligence button */}
        <div className="px-2 pt-2 flex-shrink-0">
          <motion.button
            onClick={() => handleNavClick('/')}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl transition-all duration-200 border',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
              location.pathname === '/'
                ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
                : 'bg-gradient-to-r from-dv-gold/5 to-transparent border-dv-gold/10 text-txt-secondary hover:border-dv-gold/30 hover:text-dv-gold'
            )}
          >
            <Brain size={collapsed ? 18 : 16} className="shrink-0" />
            {!collapsed && (
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold truncate">Intelligence</p>
                <p className="text-[10px] text-txt-muted truncate">Цифровой ассистент</p>
              </div>
            )}
          </motion.button>
        </div>

        {/* Services section */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-1 flex-shrink-0">
            <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Сервисы</p>
          </div>
        )}

        <motion.nav
          initial="hidden"
          animate={sidebarVisible ? 'visible' : 'hidden'}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } },
          }}
          className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 no-scrollbar"
        >
          {serviceItems.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-white/[0.06] text-txt-primary'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted group-hover:text-txt-secondary')}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className="text-sm truncate flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <Badge variant="gold" size="xs">{item.badge}</Badge>
                    )}
                  </>
                )}
              </motion.button>
            );
          })}

          {/* Platform section */}
          {!collapsed && (
            <div className="pt-3 pb-1">
              <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Платформа</p>
            </div>
          )}
          {serviceItems.filter(i => i.section === 'platform').map(item => {
            const isActive = location.pathname === item.path;
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-white/[0.06] text-txt-primary'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm truncate flex-1 text-left">{item.label}</span>}
              </motion.button>
            );
          })}

          {/* Admin section */}
          {isAdmin && !collapsed && (
            <div className="pt-3 pb-1">
              <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Администрирование</p>
            </div>
          )}
          {isAdmin && ADMIN_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-white/[0.06] text-txt-primary'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
              >
                <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm truncate flex-1 text-left">{item.label}</span>}
              </motion.button>
            );
          })}
        </motion.nav>

        {/* Logout */}
        <div className="px-2 pb-2 flex-shrink-0">
          <motion.button
            onClick={() => { logout(); navigate('/login'); }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              aria-label="Меню"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-base font-semibold truncate">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-2">
            {proactiveAlerts.length > 0 && (
              <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-amber-400 hover:bg-amber-400/10 transition-colors">
                <Bell size={16} />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center">
                  {proactiveAlerts.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setContextSheetOpen(!contextSheetOpen)}
              className={cn(
                'hidden md:flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                contextSheetOpen ? 'text-dv-gold bg-dv-gold/10' : 'text-txt-muted hover:text-txt-primary hover:bg-white/5'
              )}
              aria-label="Контекстная панель"
            >
              <Building2 size={16} />
            </button>
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 border border-dv-gold/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] font-medium text-dv-gold">AI</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-surface-0 relative min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Context Panel: Desktop (always visible when toggled) ─── */}
      {!isMobile && (
        <AnimatePresence>
          {contextSheetOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1 overflow-hidden flex-shrink-0 h-full"
            >
              <ContextPanel
                onClose={() => setContextSheetOpen(false)}
                clinic={clinic}
                user={user}
                role={roleInfo}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* ─── Context Panel: Mobile Bottom Sheet ─── */}
      <AnimatePresence>
        {isMobile && contextSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setContextSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[85vh] bg-surface-1 border-t border-bdr-subtle rounded-t-2xl shadow-2xl flex flex-col"
            >
              <div
                className="flex h-12 items-center justify-center border-b border-bdr-subtle cursor-grab active:cursor-grabbing"
                onClick={() => setContextSheetOpen(false)}
              >
                <div className="h-1 w-10 rounded-full bg-txt-muted" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <ContextPanel
                  onClose={() => setContextSheetOpen(false)}
                  clinic={clinic}
                  user={user}
                  role={roleInfo}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntelligenceLayout;
