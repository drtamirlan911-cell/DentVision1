import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
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
  Maximize2,
  Minimize2,
  Bell,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { DentVisionIntelligence } from '@/components/DentVisionIntelligence';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { ProactiveAlerts } from '@/components/intelligence/ProactiveAlerts';
import { AIServiceCards, AI_SERVICES, AI_PLATFORM_SERVICES } from '@/components/intelligence/AIServiceCards';

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
  const [aiPanelWidth, setAiPanelWidth] = useState(720);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem('dv_welcomed', '1');
    setShowWelcome(false);
    setSidebarVisible(true);
    setTimeout(() => {
      fetchProactiveAlerts();
    }, 500);
  }, []);

  const fetchProactiveAlerts = useCallback(async () => {
    try {
      const { aiProactive } = await import('@/utils/api');
      const data = await aiProactive();
      if (data?.alerts?.length) {
        setProactiveAlerts(data.alerts);
      }
    } catch {
      // ignore
    }
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

  const handleServiceSelect = (service: { id: string; path: string }) => {
    handleNavClick(service.path, service.id);
    if (!isMobile) {
      setSidebarVisible(false);
    }
  };

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const isCRMRoute = location.pathname.startsWith('/crm');
  const isShopRoute = location.pathname.startsWith('/shop');
  const isSchoolRoute = location.pathname.startsWith('/school');
  const isAIHome = location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/intelligence';

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 flex overflow-hidden">
      {/* Left Sidebar - Services Navigation */}
      <motion.div
        initial={false}
        animate={{
          x: isMobile ? (sidebarOpen ? 0 : -300) : 0,
          opacity: sidebarVisible ? 1 : 0,
          width: collapsed ? 72 : sidebarWidth,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col',
          'bg-surface-1 border-r border-bdr-subtle',
          'md:translate-x-0',
          'max-md:shadow-2xl',
        )}
        style={{ width: collapsed ? 72 : sidebarWidth, opacity: sidebarVisible ? 1 : 0 }}
        ref={sidebarRef}
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
                <p className="text-2xs text-txt-muted truncate max-w-[160px]">
                  {clinic?.name || 'Платформа'}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setCollapsed(!collapsed);
                setSidebarWidth(collapsed ? 280 : 72);
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

        {/* User Info */}
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

        {/* Services Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
          {filteredServiceItems.map((item, i) => {
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
                style={{ animationDelay: `${i * 30}ms` }}
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

        {/* Platform Services */}
        {!collapsed && filteredPlatformItems.length > 0 && (
          <>
            <div className="px-3 py-2 border-t border-bdr-subtle">
              <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider mb-2">
                Платформа
              </p>
            </div>
            <nav className="px-2 pb-3 space-y-1">
              {filteredPlatformItems.map((item, i) => {
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
                    style={{ animationDelay: `${i * 30}ms` }}
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

        {/* Logout */}
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

      {/* Main Content Area - AI Chat Center */}
      <motion.div
        initial={false}
        animate={{ width: aiPanelWidth }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-1 flex-col min-w-0 relative"
        style={{ 
          width: `calc(100% - ${collapsed ? 72 : sidebarWidth}px - ${contextPanelOpen ? 340 : 0}px)`,
          minWidth: 520,
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
              {filteredServiceItems.find((i) => location.pathname.startsWith(i.path))?.label || 
               filteredPlatformItems.find((i) => location.pathname === i.path)?.label || 
               'DentVision Intelligence'}
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
              <LayoutDashboard size={14} />
              <span className="hidden sm:inline">Все сервисы</span>
            </motion.button>
            
            {/* AI Panel Resize Handle */}
            <div 
              className="w-px h-8 bg-gradient-to-b from-transparent via-bdr-subtle to-transparent mx-1" 
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = aiPanelWidth;
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const newWidth = Math.max(520, Math.min(1000, startWidth + (startX - moveEvent.clientX)));
                  setAiPanelWidth(newWidth);
                };
                const onMouseUp = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-0 relative">
          <div className="h-full w-full">
            <Outlet context={{ user, clinic, roleInfo }} />
          </div>

          {/* AI Intelligence Center - Central Hub */}
          {isAIHome && (
            <DentVisionIntelligence 
              onNavigate={(path) => handleNavClick(path)}
              proactiveAlerts={proactiveAlerts}
            />
          )}

          {/* Proactive Alerts Banner */}
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
        </main>
      </motion.div>

      {/* Right Context Panel */}
      <motion.aside
        initial={{ width: 340, opacity: 1, x: 0 }}
        animate={{ 
          width: contextPanelOpen ? 340 : 0, 
          opacity: contextPanelOpen ? 1 : 0,
          x: contextPanelOpen ? 0 : 20
        }}
        exit={{ width: 0, opacity: 0, x: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={cn(
          'hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1',
          'overflow-hidden'
        )}
        style={{ width: contextPanelOpen ? 340 : 0, opacity: contextPanelOpen ? 1 : 0 }}
      >
        <ContextPanel />
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <motion.div
        initial={false}
        animate={{ opacity: isMobile && sidebarOpen ? 1 : 0 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={toggleSidebar}
      />

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-surface-1/80 backdrop-blur-xl border-t border-bdr-subtle">
          <div className="flex items-center justify-around h-14 px-2">
            {[
              { id: 'home', label: 'AI', icon: <Bot size={22} />, path: '/' },
              { id: 'crm', label: 'CRM', icon: <Stethoscope size={22} />, path: '/crm/schedule' },
              { id: 'shop', label: 'Shop', icon: <ShoppingCart size={22} />, path: '/shop' },
              { id: 'school', label: 'School', icon: <GraduationCap size={22} />, path: '/school' },
              { id: 'settings', label: 'Настройки', icon: <Settings size={22} />, path: '/settings' },
            ].map((item) => {
              const active = location.pathname.startsWith(item.path) || (item.path === '/' && location.pathname === '/');
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