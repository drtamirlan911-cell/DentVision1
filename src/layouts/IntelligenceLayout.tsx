import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Sparkles,
  Brain,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { DentVisionIntelligence } from '@/components/DentVisionIntelligence';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';

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
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    const shown = sessionStorage.getItem('dv_welcomed');
    if (shown) return false;
    return true;
  });
  const [activeService, setActiveService] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(700);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem('dv_welcomed', '1');
    setShowWelcome(false);
    setSidebarVisible(true);
  }, []);

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

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const isCRMRoute = location.pathname.startsWith('/crm');
  const isShopRoute = location.pathname.startsWith('/shop');
  const isSchoolRoute = location.pathname.startsWith('/school');
  const isAIHome = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 flex overflow-hidden">
      <motion.div
        initial={false}
        animate={{
          x: window.innerWidth < 768 ? (sidebarOpen ? 0 : -280) : 0,
          opacity: sidebarVisible ? 1 : 0,
          width: collapsed ? 70 : sidebarWidth,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'bg-surface-1 border-r border-bdr-subtle',
          'md:translate-x-0',
          'max-md:shadow-2xl',
        )}
        style={{ width: collapsed ? 70 : sidebarWidth, opacity: sidebarVisible ? 1 : 0 }}
        ref={sidebarRef}
      >
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
              onClick={() => {
                setCollapsed(!collapsed);
                setSidebarWidth(collapsed ? 260 : 70);
              }}
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

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
          {filteredServiceItems.map((item) => {
            const isActive = activeService === item.id || location.pathname.startsWith(item.path);
            return (
              <motion.button
                key={item.id}
                layout
                onClick={() => handleNavClick(item.path, item.id)}
                className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                  isActive
                    ? 'bg-dv-gold/10 text-dv-gold font-semibold'
                    : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
                title={collapsed ? item.label : undefined}
                whileTap={{ scale: 0.98 }}
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
              </motion.button>
            );
          })}
        </nav>

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
                  <motion.button
                    key={item.id}
                    layout
                    onClick={() => handleNavClick(item.path)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150 px-3 py-2',
                      isActive
                        ? 'bg-dv-gold/10 text-dv-gold font-semibold'
                        : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-dv-gold' : 'text-txt-muted')}>
                      {item.icon}
                    </span>
                    <span className="text-sm truncate">{item.label}</span>
                  </motion.button>
                );
              })}
            </nav>
          </>
        )}

        <div className="px-3 py-3 border-t border-bdr-subtle">
          <motion.button
            onClick={() => { logout(); navigate('/login'); }}
            layout
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ width: aiPanelWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-1 flex-col min-w-0 relative"
        style={{ 
          width: `calc(100% - ${collapsed ? 70 : sidebarWidth}px - 320px)`,
          minWidth: 500,
        }}
        ref={contentRef}
      >
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <Menu size={18} />
            </button>
            <motion.h2
              layoutId="page-title"
              className="text-base font-semibold text-txt-primary"
            >
              {SERVICE_NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))?.label || 
               PLATFORM_NAV_ITEMS.find((i) => location.pathname === i.path)?.label || 
               'DentVision'}
            </motion.h2>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => navigate('/')}
              layoutId="home-btn"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Все сервисы</span>
            </motion.button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-0 relative">
          <div className="h-full w-full">
            <Outlet context={{ user, clinic, roleInfo }} />
          </div>

          {isAIHome && (
            <DentVisionIntelligence 
              onNavigate={(path) => {
                handleNavClick(path);
              }}
            />
          )}
        </main>
      </motion.div>

      <motion.aside
        initial={{ width: 320, opacity: 1, x: 0 }}
        animate={{ 
          width: 320, 
          opacity: 1,
          x: 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1"
        style={{ width: 320, opacity: sidebarVisible ? 1 : 0 }}
      >
        <ContextPanel />
      </motion.aside>

      <motion.div
        initial={false}
        animate={{ opacity: window.innerWidth < 768 && sidebarOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={toggleSidebar}
      />

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
                <motion.button
                  key={item.id}
                  layoutId={`bottomnav-${item.id}`}
                  onClick={() => navigate(item.path)}
                  className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
                  whileTap={{ scale: 0.9 }}
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
                </motion.button>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </nav>
    </div>
  );
}