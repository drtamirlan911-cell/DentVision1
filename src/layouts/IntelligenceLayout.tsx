import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Stethoscope, ChevronLeft, X, LogOut, LayoutGrid, Menu, Brain, Bell, ShoppingCart, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useUIStore } from '@/stores/useUIStore';
import { Avatar } from '@/components/ui/ds/Avatar';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { AI_SERVICES, AI_PLATFORM_SERVICES } from '@/components/intelligence/AIServiceCards';
import { aiProactive } from '@/utils/api';


export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('dv_welcomed');
  });
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);
  const [isMobile, setIsMobile] = useState(false);

  const handleWelcomeComplete = useCallback(() => {
    sessionStorage.setItem('dv_welcomed', '1');
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const allowedPages = roleInfo?.pages || [];

  const filteredServiceItems = AI_SERVICES.filter(item => {
    if (item.category === 'platform') return true;
    return allowedPages.some(page =>
      item.path.includes(page) ||
      (item.id === 'crm' && allowedPages.includes('schedule')) ||
      (item.id === 'shop' && allowedPages.includes('shop')) ||
      (item.id === 'school' && allowedPages.includes('school'))
    );
  });

  const filteredPlatformItems = AI_PLATFORM_SERVICES.filter(item => {
    if (item.id === 'admin') return allowedPages.includes('admin');
    if (item.id === 'audit') return allowedPages.includes('audit');
    if (item.id === 'backup') return allowedPages.includes('backup');
    return true;
  });

  const isIntelligence = location.pathname === '/';
  const isCRMRoute = location.pathname.startsWith('/crm');
  const isShopRoute = location.pathname.startsWith('/shop');
  const isSchoolRoute = location.pathname.startsWith('/school');

  const getPageTitle = () => {
    if (isIntelligence) return 'DentVision Intelligence';
    if (isCRMRoute) return 'CRM';
    if (isShopRoute) return 'Маркетплейс';
    if (isSchoolRoute) return 'Академия';
    const item = [...AI_SERVICES, ...AI_PLATFORM_SERVICES].find(i => location.pathname === i.path);
    return item?.name || 'Сервис';
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) toggleSidebar();
  };

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden">
      <div
        className="h-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `${sidebarWidth}px 1fr ${0}px`,
          gridTemplateRows: '1fr',
        }}
      >
        {/* Mobile sidebar overlay */}
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

        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{
            x: isMobile ? (sidebarOpen ? 0 : -sidebarWidth) : 0,
            width: sidebarWidth,
            opacity: sidebarVisible ? 1 : 0,
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="h-full flex flex-col bg-surface-1 border-r border-bdr-subtle z-50"
          style={{ width: sidebarWidth }}
        >
          <div className="flex items-center justify-between px-3 h-14 border-b border-bdr-subtle flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/15">
                <Stethoscope size={16} className="text-dv-gold" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-dv-gold tracking-tight truncate">DentVision</h1>
                  <p className="text-2xs text-txt-muted truncate max-w-[140px]">Platform</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              {collapsed ? '<' : '<'}
            </button>
          </div>

          {!collapsed && (
            <div className="px-3 py-2.5 border-b border-bdr-subtle flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Avatar name={user?.name || user?.login || '?'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-txt-primary truncate">{user?.name || user?.login}</p>
                  <p className="text-2xs text-txt-muted">Сотрудник</p>
                </div>
              </div>
            </div>
          )}

          <div className="px-2 pt-2 flex-shrink-0">
            <motion.button
              onClick={() => handleNavClick('/')}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl transition-all duration-200 border',
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                true
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
            {['CRM', 'Маркетплейс', 'Академия'].map(item => (
              <button
                key={item}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg transition-all duration-150 px-3 py-2',
                  'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                )}
              >
                <span className="text-sm">{item}</span>
              </button>
            ))}
          </motion.nav>

          {/* Platform services */}
          {!collapsed && (
            <>
              <div className="px-3 pt-3 pb-1 flex-shrink-0">
                <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">Платформа</p>
              </div>
            </>
          )}

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
        </motion.aside>

        <main className="flex flex-col min-w-0 overflow-hidden" style={{ minWidth: 0 }}>
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
                className="text-base font-semibold truncate"
              >
                Test
              </motion.h2>
            </div>
          </header>

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
        </main>

        {/* Context panel - Desktop */}
        <AnimatePresence>
          {contextSheetOpen && !isMobile && (
            <motion.aside
              initial={{ width: 0, opacity: 0, x: 20 }}
              animate={{ width: 320, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1 overflow-hidden flex-shrink-0"
              style={{ width: 320 }}
            >
              <div>Context Panel</div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

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
              <motion.aside
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[85vh] bg-surface-1 border-t border-bdr-subtle rounded-t-2xl shadow-2xl flex flex-col"
                style={{ maxHeight: '85vh' }}
              >
                <div className="flex h-12 items-center justify-center border-b border-bdr-subtle">
                  <motion.div
                    className="h-1 w-10 rounded-full bg-txt-muted"
                    whileHover={{ scaleX: 1.5 }}
                    whileTap={{ scaleX: 0.8 }}
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div>Context Panel</div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
    </div>
  );
}

export default IntelligenceLayout;