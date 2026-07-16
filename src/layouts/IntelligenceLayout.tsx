import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  ChevronLeft,
  X,
  LogOut,
  LayoutGrid,
  BarChart3,
  Settings,
  Shield,
  Database,
  Bot,
  User,
  ShoppingCart,
  GraduationCap,
  FlaskConical,
  DollarSign,
  FileText,
  Calendar,
  Users,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { DentVisionIntelligence } from '@/components/DentVisionIntelligence';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  category?: 'crm' | 'shop' | 'school' | 'platform';
}

const SERVICE_NAV_ITEMS: NavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={18} />, path: '/crm/schedule', category: 'crm' },
  { id: 'patients', label: 'Пациенты', icon: <Users size={18} />, path: '/crm/patients', category: 'crm' },
  { id: 'schedule', label: 'Расписание', icon: <Calendar size={18} />, path: '/crm/schedule', category: 'crm' },
  { id: 'cashier', label: 'Касса', icon: <DollarSign size={18} />, path: '/crm/cashier', category: 'crm' },
  { id: 'lab', label: 'Лаборатория', icon: <FlaskConical size={18} />, path: '/crm/lab', category: 'crm' },
  { id: 'shop', label: 'Shop', icon: <ShoppingCart size={18} />, path: '/shop', category: 'shop' },
  { id: 'school', label: 'School', icon: <GraduationCap size={18} />, path: '/school', category: 'school' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} />, path: '/analytics', category: 'platform' },
  { id: 'documents', label: 'Документы', icon: <FileText size={18} />, path: '/crm/documents', category: 'crm' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={18} />, path: '/settings', category: 'platform' },
];

const PLATFORM_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Главная', icon: <LayoutGrid size={18} />, path: '/dashboard' },
  { id: 'ai', label: 'AI Команда', icon: <Bot size={18} />, path: '/ai' },
  { id: 'profile', label: 'Профиль', icon: <User size={18} />, path: '/profile' },
  { id: 'admin', label: 'Super Admin', icon: <Shield size={18} />, path: '/admin' },
  { id: 'audit', label: 'Аудит', icon: <Shield size={18} />, path: '/audit' },
  { id: 'backup', label: 'Бэкапы', icon: <Database size={18} />, path: '/backup' },
];

export default function IntelligenceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [activeService, setActiveService] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }
    // После анимации приветствия скрываем полный экран Intelligence
    const timer = setTimeout(() => {
      setShowIntelligence(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const allowedPages = roleInfo?.pages || [];
  
  const filteredServiceItems = SERVICE_NAV_ITEMS.filter((item) => {
    if (item.category === 'platform') return true;
    return allowedPages.some(page => 
      item.path.includes(page) || 
      (item.id === 'crm' && allowedPages.includes('schedule')) ||
      (item.id === 'shop' && allowedPages.includes('shop')) ||
      (item.id === 'school' && allowedPages.includes('school'))
    );
  });

  const filteredPlatformItems = PLATFORM_NAV_ITEMS.filter((item) => {
    if (item.id === 'admin') return allowedPages.includes('admin');
    if (item.id === 'audit') return allowedPages.includes('audit');
    if (item.id === 'backup') return allowedPages.includes('backup');
    return true;
  });

  const handleNavClick = (path: string, serviceId?: string) => {
    navigate(path);
    if (serviceId) setActiveService(serviceId);
    if (window.innerWidth < 768) toggleSidebar();
  };

  // Welcome Screen Animation
  if (showIntelligence) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-0">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="flex h-24 w-24 items-center justify-center rounded-2xl bg-dv-gold/15 shadow-2xl shadow-dv-gold/20"
              >
                <Stethoscope size={48} className="text-dv-gold" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-3xl font-bold text-txt-primary tracking-tight"
              >
                DentVision
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-sm text-txt-muted"
              >
                Intelligence Platform
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Service Cards appearing */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl px-8">
            {filteredServiceItems.slice(0, 8).map((service, index) => (
              <motion.button
                key={service.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1, duration: 0.4 }}
                onClick={() => handleNavClick(service.path, service.id)}
                className="group relative overflow-hidden rounded-xl border border-bdr-subtle p-5 text-left bg-surface-1 hover:bg-surface-2 transition-all hover:scale-105"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold mb-3">
                  {service.icon}
                </div>
                <h3 className="text-sm font-semibold text-txt-primary">{service.label}</h3>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
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

      {/* Left Sidebar - Services */}
      <motion.aside
        initial={false}
        animate={{
          width: collapsed ? 'var(--dv-sidebar-collapsed, 70px)' : 'var(--dv-sidebar-width, 260px)',
          x: window.innerWidth < 768 ? (sidebarOpen ? 0 : -280) : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'bg-surface-1 border-r border-bdr-subtle',
          'md:translate-x-0',
          'max-md:shadow-2xl',
        )}
        style={{ width: collapsed ? '70px' : '260px' }}
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
                <p className="text-2xs text-txt-muted truncate max-w-[140px]">
                  {clinic?.name || 'Платформа'}
                </p>
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

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-3 border-b border-bdr-subtle">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-txt-primary truncate">
                  {user?.name || user?.login}
                </p>
                <p className="text-2xs text-txt-muted">{roleInfo?.label || 'Сотрудник'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Service Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
          {filteredServiceItems.map((item) => {
            const isActive = activeService === item.id || location.pathname.startsWith(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path, item.id)}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-dv-gold/10 text-dv-gold font-semibold'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="service-sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-dv-gold"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted group-hover:text-txt-secondary')}>
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Platform Navigation */}
        {!collapsed && filteredPlatformItems.length > 0 && (
          <>
            <div className="px-3 py-2 border-t border-bdr-subtle">
              <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider mb-2">
                Платформа
              </p>
            </div>
            <nav className="px-2 pb-3 space-y-1">
              {filteredPlatformItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150 px-3 py-2',
                      isActive
                        ? 'bg-dv-gold/10 text-dv-gold font-semibold'
                        : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                    )}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-dv-gold' : 'text-txt-muted')}>
                      {item.icon}
                    </span>
                    <span className="text-sm truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}

        {/* Footer */}
        <div className="px-3 py-3 border-t border-bdr-subtle">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 md:ml-[260px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-base font-semibold text-txt-primary">
              {SERVICE_NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))?.label || 
               PLATFORM_NAV_ITEMS.find((i) => location.pathname === i.path)?.label || 
               'DentVision'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <LayoutGrid size={14} />
              Все сервисы
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-surface-0">
          <div className="p-4 md:p-6 pb-20 md:pb-6">
            <Outlet context={{ user, clinic, roleInfo }} />
          </div>
        </main>
      </div>

      {/* Right Context Panel - Collapsible */}
      <motion.aside
        initial={{ width: 320, opacity: 1 }}
        animate={{ 
          width: 320, 
          opacity: 1,
          x: 0
        }}
        className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1"
        style={{ width: 320 }}
      >
        <div className="h-14 border-b border-bdr-subtle flex items-center justify-between px-4">
          <h3 className="text-sm font-semibold text-txt-primary">Контекст</h3>
          <button className="text-txt-muted hover:text-txt-primary">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Context content will be populated by child pages */}
          <div className="text-sm text-txt-muted">
            <p className="mb-2">AI будет отображать здесь релевантную информацию на основе текущего раздела.</p>
          </div>
        </div>
      </motion.aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-surface-1/80 backdrop-blur-xl border-t border-bdr-subtle">
          <div className="flex items-center justify-around h-14 px-2">
            {[
              { id: 'home', label: 'Главная', icon: <LayoutGrid size={20} />, path: '/' },
              { id: 'crm', label: 'CRM', icon: <Stethoscope size={20} />, path: '/crm/schedule' },
              { id: 'shop', label: 'Shop', icon: <ShoppingCart size={20} />, path: '/shop' },
              { id: 'school', label: 'School', icon: <GraduationCap size={20} />, path: '/school' },
              { id: 'settings', label: 'Настройки', icon: <Settings size={20} />, path: '/settings' },
            ].map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
                >
                  <div
                    className={cn(
                      'relative flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200',
                      active ? 'text-dv-gold' : 'text-txt-muted'
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="intelligence-bottomnav-indicator"
                        className="absolute inset-0 bg-dv-gold/10 rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{item.icon}</span>
                  </div>
                  <span className={cn('text-2xs font-medium transition-colors', active ? 'text-dv-gold' : 'text-txt-muted')}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </nav>
    </div>
  );
}
