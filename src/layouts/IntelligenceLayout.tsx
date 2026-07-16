import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Stethoscope,
  ChevronLeft,
  X,
  LogOut,
  LayoutGrid,
  Settings,
  Bot,
  User,
  ShoppingCart,
  GraduationCap,
  Menu,
  Sparkles,
  Brain,
  Zap,
  Bell,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { aiProactive } from '@/utils/api';
import { DentVisionIntelligence } from '@/components/DentVisionIntelligence';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { ProactiveAlerts } from '@/components/intelligence/ProactiveAlerts';
import { AI_SERVICES, AI_PLATFORM_SERVICES, type ServiceCardDef } from '@/components/intelligence/AIServiceCards';

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
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem('dv_welcomed', '1');
    setShowWelcome(false);
    setSidebarVisible(true);
    setTimeout(() => fetchProactiveAlerts(), 500);
  }, []);

  const fetchProactiveAlerts = useCallback(async () => {
    try {
      const data = await aiProactive();
      if (data?.alerts?.length) {
        setProactiveAlerts(data.alerts);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const allowedPages = roleInfo?.pages || [];

  const filteredServiceItems = useMemo(() =>
    AI_SERVICES.filter((item) => {
      if (item.category === 'platform') return true;
      return allowedPages.some(page =>
        item.path.includes(page) ||
        (item.id === 'crm' && allowedPages.includes('schedule')) ||
        (item.id === 'shop' && allowedPages.includes('shop')) ||
        (item.id === 'school' && allowedPages.includes('school'))
      );
    }), [allowedPages]
  );

  const filteredPlatformItems = useMemo(() =>
    AI_PLATFORM_SERVICES.filter((item) => {
      if (item.id === 'admin') return allowedPages.includes('admin');
      if (item.id === 'audit') return allowedPages.includes('audit');
      if (item.id === 'backup') return allowedPages.includes('backup');
      return true;
    }), [allowedPages]
  );

  const handleNavClick = (path: string, serviceId?: string) => {
    navigate(path);
    if (serviceId) setActiveService(serviceId);
    if (isMobile) toggleSidebar();
  };

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const isAIHome = location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/intelligence';
  const isCRMRoute = location.pathname.startsWith('/crm');
  const isShopRoute = location.pathname.startsWith('/shop');
  const isSchoolRoute = location.pathname.startsWith('/school');

  const sidebarWidth = collapsed ? 72 : 240;
  const contextWidth = contextPanelOpen && !isMobile ? 320 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-surface-0 overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth}px 1fr ${contextWidth}px`,
        gridTemplateRows: '1fr',
      }}
    >
      {/* Mobile Sidebar Overlay */}
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

      {/* ───── LEFT SIDEBAR ───── */}
      <motion.aside
        initial={false}
        animate={{
          x: isMobile ? (sidebarOpen ? 0 : -sidebarWidth) : 0,
          width: sidebarWidth,
          opacity: sidebarVisible ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'h-full flex flex-col bg-surface-1 border-r border-bdr-subtle z-50',
          isMobile && 'fixed left-0 top-0 bottom-0 shadow-2xl'
        )}
        style={{ width: sidebarWidth }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-bdr-subtle flex-shrink-0">
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

        {/* User Info */}
        {!collapsed && (
          <div className="px-3 py-2.5 border-b border-bdr-subtle flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Avatar name={user?.name || user?.login || '?'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-txt-primary truncate">
                  {user?.name || user?.login}
                </p>
                <p className="text-2xs text-txt-muted">{roleInfo?.label || 'Сотрудник'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Intelligence Button */}
        <div className={cn('px-2 pt-2 flex-shrink-0', collapsed && 'px-1')}>
          <motion.button
            onClick={() => handleNavClick('/')}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl transition-all duration-200 border',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
              isAIHome
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

        {/* Services Header */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-1 flex-shrink-0">
            <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Сервисы</p>
          </div>
        )}

        {/* Services Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 no-scrollbar">
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
                title={collapsed ? item.name : undefined}
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
                {!collapsed && <span className="text-sm truncate">{item.name}</span>}
              </motion.button>
            );
          })}
        </nav>

        {/* Platform Services */}
        {!collapsed && filteredPlatformItems.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 flex-shrink-0 border-t border-bdr-subtle">
              <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Платформа</p>
            </div>
            <nav className="px-2 pb-2 space-y-0.5 flex-shrink-0">
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
                    <span className="text-sm truncate">{item.name}</span>
                  </motion.button>
                );
              })}
            </nav>
          </>
        )}

        {/* Logout */}
        <div className="px-3 py-2 border-t border-bdr-subtle flex-shrink-0">
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
      </motion.aside>

      {/* ───── CENTER: MAIN CONTENT ───── */}
      <main className="flex flex-col min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <Menu size={18} />
            </button>
            <motion.h2
              layoutId="page-title"
              className={cn(
                'text-base font-semibold truncate',
                isAIHome ? 'text-dv-gold' : 'text-txt-primary'
              )}
            >
              {isAIHome ? 'DentVision Intelligence' : (
                filteredServiceItems.find((i) => location.pathname.startsWith(i.path))?.name ||
                filteredPlatformItems.find((i) => location.pathname === i.path)?.name ||
                'Сервис'
              )}
            </motion.h2>
            {isAIHome && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 border border-dv-gold/20"
              >
                <Zap size={10} className="text-dv-gold" />
                <span className="text-[10px] font-medium text-dv-gold">Онлайн</span>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Proactive alerts bell */}
            {proactiveAlerts.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setContextPanelOpen(!contextPanelOpen)}
                className="relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-all"
              >
                <Bell size={14} />
                <span className="text-xs font-medium hidden sm:inline">{proactiveAlerts.length}</span>
              </motion.button>
            )}

            {/* Context panel toggle */}
            <button
              onClick={() => setContextPanelOpen(!contextPanelOpen)}
              className={cn(
                'hidden lg:flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                contextPanelOpen
                  ? 'bg-dv-gold/10 text-dv-gold'
                  : 'text-txt-muted hover:text-txt-primary hover:bg-white/5'
              )}
            >
              <LayoutGrid size={16} />
            </button>

            {/* AI minimize */}
            {isAIHome && (
              <button
                onClick={() => setAiMinimized(!aiMinimized)}
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              >
                {aiMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
            )}

            <button
              onClick={() => handleNavClick('/profile')}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <Avatar name={user?.name || user?.login || '?'} size="xs" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-surface-0 relative min-h-0">
          {/* Sub-app content (CRM, Shop, School routes) */}
          <AnimatePresence mode="wait">
            {!isAIHome && (
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Outlet context={{ user, clinic, roleInfo }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Intelligence Center */}
          {isAIHome && (
            <div className={cn('h-full', aiMinimized ? 'flex items-center justify-center' : '')}>
              <DentVisionIntelligence
                onNavigate={(path) => handleNavClick(path)}
                proactiveAlerts={proactiveAlerts}
                minimized={aiMinimized}
                onToggleMinimize={() => setAiMinimized(!aiMinimized)}
              />
            </div>
          )}

          {/* Floating Proactive Alerts */}
          {proactiveAlerts.length > 0 && !isAIHome && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40"
            >
              <ProactiveAlerts alerts={proactiveAlerts} onDismiss={(text) => {
                setProactiveAlerts(prev => prev.filter(a => a.text !== text));
              }} />
            </motion.div>
          )}

          {/* Welcome/empty state for AI Home */}
          {isAIHome && aiMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full text-center px-4"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-dv-gold/10 border border-dv-gold/20 mb-4">
                <Brain size={32} className="text-dv-gold" />
              </div>
              <h3 className="text-lg font-semibold text-txt-primary mb-1">DentVision Intelligence</h3>
              <p className="text-sm text-txt-muted max-w-sm">
                AI ассистент свёрнут. Нажмите на иконку в правом нижнем углу чтобы продолжить.
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* ───── RIGHT CONTEXT PANEL ───── */}
      <AnimatePresence>
        {contextPanelOpen && !isMobile && (
          <motion.aside
            initial={{ width: 0, opacity: 0, x: 20 }}
            animate={{ width: 320, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1 overflow-hidden flex-shrink-0"
            style={{ width: 320 }}
          >
            <ContextPanel
              onClose={() => setContextPanelOpen(false)}
              clinic={clinic}
              user={user}
              role={roleInfo}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ───── MOBILE BOTTOM NAV ───── */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="bg-surface-1/80 backdrop-blur-xl border-t border-bdr-subtle">
            <div className="flex items-center justify-around h-14 px-2">
              {[
                { id: 'home', label: 'AI', icon: <Brain size={22} />, path: '/' },
                { id: 'crm', label: 'CRM', icon: <Stethoscope size={22} />, path: '/crm/schedule' },
                { id: 'shop', label: 'Shop', icon: <ShoppingCart size={22} />, path: '/shop' },
                { id: 'school', label: 'School', icon: <GraduationCap size={22} />, path: '/school' },
                { id: 'settings', label: 'Eщё', icon: <LayoutGrid size={22} />, path: '/settings' },
              ].map((item) => {
                const active = location.pathname.startsWith(item.path) || (item.path === '/' && isAIHome);
                return (
                  <motion.button
                    key={item.id}
                    layoutId={`bottomnav-${item.id}`}
                    onClick={() => handleNavClick(item.path)}
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
      )}

      {/* Mobile bottom padding */}
      {isMobile && <div className="h-14" />}
    </div>
  );
}
