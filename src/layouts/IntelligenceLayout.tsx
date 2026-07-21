import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ChevronRight, Menu, Building2, User, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useGuestStore } from '@/store/guest.store';
import { useAIWorkspaceStore } from '@/store/workspace.store';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { useAIStore } from '@/store/ai.store';
import { trackProductEvent } from '@/utils/analytics';
import { Sidebar } from './Sidebar';
import { AlertDropdown } from './AlertDropdown';
import { BottomNav } from './BottomNav';
import RegistrationModal from '@/components/guest/RegistrationModal';
import GuestCRMModal from '@/components/guest/GuestCRMModal';
import { DentCashHeaderChip } from '@/components/wallet/DentCashHeaderChip';

const BREADCRUMB_LABELS: Record<string, string> = {
  crm: 'CRM',
  schedule: 'Расписание',
  patients: 'Пациенты',
  'medical-card': 'Медкарта',
  finance: 'Финансы',
  cashier: 'Касса',
  inventory: 'Склад',
  documents: 'Документы',
  'dental-chart': 'Зубная карта',
  'treatment-plans': 'Планы лечения',
  lab: 'Лаборатория',
  pricelist: 'Прайс',
  staff: 'Сотрудники',
  reminders: 'Напоминания',
  promotions: 'Акции',
  icd10: 'МКБ-10',
  visits: 'Визиты',
  supplier: 'Кабинет продавца',
  shop: 'Маркетплейс',
  school: 'Academy OS',
  'school-workspace': 'Кабинет лектора',
  analytics: 'Аналитика',
  jobs: 'Вакансии',
  community: 'Сообщество',
  ai: 'AI Команда',
  profile: 'Профиль',
  'clinic-settings': 'Настройки клиники',
  billing: 'Тариф и оплата',
  settings: 'Настройки',
  admin: 'Администрирование',
  audit: 'Аудит',
  backup: 'Бэкапы',
};

const FIRST_RUN_COLLAPSE_MS = 15_000;

export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { isGuest, isGuestRoute, requiresAuth, initGuest, showRegistrationModal, setRegistrationModal } = useGuestStore();
  const {
    sidebarOpen,
    toggleSidebar,
    contextSheetOpen,
    setContextSheetOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarPinned,
    sidebarVisible,
    setSidebarVisible,
    sidebarHovering,
    setSidebarHovering,
    firstRunPhase,
    setFirstRunPhase,
    completeFirstRun,
    toggleSidebarCollapsed,
  } = useUIStore();
  const setOnboardingComplete = useAIWorkspaceStore((s) => s.setOnboardingComplete);

  const isPublicRoute = isGuestRoute(location.pathname);
  const needsAuth = requiresAuth(location.pathname) && !isAuthenticated;
  const isAIHome = location.pathname === '/';

  const proactiveAlerts = useAIStore((s) => s.proactiveAlerts);
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts);
  const [isMobile, setIsMobile] = useState(false);
  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);
  const [guestCRMOpen, setGuestCRMOpen] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunBooted = useRef(false);
  const openTs = useRef(Date.now());

  const handleAIQuery = useCallback((query: string) => {
    navigate('/', { state: { aiQuery: query } });
  }, [navigate]);

  const getBreadcrumbs = useCallback(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'AI Workspace', path: '/' }];
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';
    for (const seg of segments) {
      accumulated += '/' + seg;
      crumbs.push({ label: BREADCRUMB_LABELS[seg] || seg, path: accumulated });
    }
    return crumbs;
  }, [location.pathname]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) setContextSheetOpen(false);
  }, [isMobile, setContextSheetOpen]);

  useEffect(() => {
    const t = setTimeout(() => { void loadProactiveAlerts() }, 500);
    return () => clearTimeout(t);
  }, [loadProactiveAlerts]);

  // Guests always get a labeled expanded sidebar (never icon-only rail).
  useEffect(() => {
    if (!isGuest) return;
    setSidebarVisible(true);
    setSidebarCollapsed(false);
    setFirstRunPhase('done');
    completeFirstRun();
    setOnboardingComplete(true);
    firstRunBooted.current = true;
    // Show the right twin panel by default so guests see the platform guide.
    if (!isMobile) setContextSheetOpen(true);
  }, [
    isGuest,
    isMobile,
    setSidebarVisible,
    setSidebarCollapsed,
    setFirstRunPhase,
    completeFirstRun,
    setOnboardingComplete,
    setContextSheetOpen,
  ]);

  // ── First-run: greeting → functional sidebar dock → 15s collapse ──
  useEffect(() => {
    if (isGuest) return;
    if (firstRunBooted.current) return;
    if (firstRunPhase === 'done') {
      setSidebarVisible(true);
      return;
    }
    if (!isAIHome) {
      setSidebarVisible(true);
      setFirstRunPhase('done');
      completeFirstRun();
      setOnboardingComplete(true);
      return;
    }

    firstRunBooted.current = true;
    trackProductEvent('first_run_started', { role: user?.role || 'guest' });
    setFirstRunPhase('greeting');
    setSidebarVisible(false);
    setSidebarCollapsed(false);

    const dockTimer = setTimeout(() => {
      setFirstRunPhase('docking');
      setSidebarVisible(true);
      setFirstRunPhase('docked');
      trackProductEvent('sidebar_docked', { t_ms: Date.now() - openTs.current });
    }, 700);

    return () => clearTimeout(dockTimer);
  }, [
    isGuest,
    firstRunPhase,
    isAIHome,
    setSidebarVisible,
    setSidebarCollapsed,
    setFirstRunPhase,
    completeFirstRun,
    setOnboardingComplete,
    user?.role,
  ]);

  // 15s auto-collapse after dock (pause while hovering / pinned)
  useEffect(() => {
    if (isGuest) return;
    if (firstRunPhase !== 'docked' || sidebarPinned || isMobile) return;

    const clear = () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };

    if (sidebarHovering) {
      clear();
      return clear;
    }

    collapseTimerRef.current = setTimeout(() => {
      setSidebarCollapsed(true);
      setFirstRunPhase('collapsed');
      completeFirstRun();
      setOnboardingComplete(true);
      trackProductEvent('sidebar_auto_collapsed', { after_ms: FIRST_RUN_COLLAPSE_MS });
    }, FIRST_RUN_COLLAPSE_MS);

    return clear;
  }, [
    isGuest,
    firstRunPhase,
    sidebarPinned,
    sidebarHovering,
    isMobile,
    setSidebarCollapsed,
    setFirstRunPhase,
    completeFirstRun,
    setOnboardingComplete,
  ]);

  useEffect(() => {
    if (location.pathname !== '/' && firstRunPhase !== 'done') {
      // Navigating away during first-run still completes onboarding
      completeFirstRun();
      setOnboardingComplete(true);
      setFirstRunPhase('done');
      setSidebarVisible(true);
      trackProductEvent('first_navigation', {
        target: location.pathname,
        t_ms: Date.now() - openTs.current,
      });
    }
  }, [location.pathname, firstRunPhase, completeFirstRun, setOnboardingComplete, setFirstRunPhase, setSidebarVisible]);

  if (!isAuthenticated && !isGuest && !isPublicRoute) {
    initGuest();
  }

  if (needsAuth) {
    if (isGuest) {
      const isCRMRoute = location.pathname.startsWith('/crm');
      if (isCRMRoute) {
        if (!guestCRMOpen) {
          setGuestCRMOpen(true);
        }
        return (
          <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-dv-gold/15 flex items-center justify-center">
                <Stethoscope size={24} className="text-dv-gold" />
              </div>
              <h2 className="text-lg font-semibold text-txt-primary">CRM Стоматологии</h2>
              <p className="text-sm text-txt-secondary max-w-xs">Выберите способ начать работу с CRM</p>
            </div>
            <GuestCRMModal open={guestCRMOpen} onClose={() => { setGuestCRMOpen(false); navigate('/'); }} />
          </div>
        );
      }
      const pendingPath = location.pathname;
      if (!showRegistrationModal) {
        setRegistrationModal(true, () => navigate(pendingPath));
      }
      return (
        <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-dv-gold/15 flex items-center justify-center">
              <User size={24} className="text-dv-gold" />
            </div>
            <h2 className="text-lg font-semibold text-txt-primary">Требуется авторизация</h2>
            <p className="text-sm text-txt-secondary max-w-xs">Войдите или зарегистрируйтесь для доступа</p>
            <button
              onClick={() => setRegistrationModal(true, () => navigate(pendingPath))}
              className="px-6 py-2.5 rounded-lg bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors"
            >
              Зарегистрироваться
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex">
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

      <div
        onMouseEnter={() => setSidebarHovering(true)}
        onMouseLeave={() => setSidebarHovering(false)}
        className="contents"
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={(v) => {
            setSidebarCollapsed(v);
            if (!v) {
              trackProductEvent('sidebar_user_expanded');
            }
          }}
          sidebarVisible={sidebarVisible}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          user={isGuest ? { id: 'guest', name: 'Гость', login: 'guest', role: 'guest', platformRole: 'guest' } as any : user}
          roleInfo={isGuest ? { label: 'Гость', icon: '👤', pages: ['shop', 'school', 'jobs', 'community', 'demo'] } as any : roleInfo}
          logout={isGuest ? () => {} : logout}
          toggleSidebar={toggleSidebar}
          isGuest={isGuest}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-0/60 backdrop-blur-xl border-b border-white/[0.04] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              aria-label="Меню"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-txt-muted">
                {getBreadcrumbs().map((crumb, idx, crumbs) => (
                  <span key={crumb.path} className="flex items-center gap-1.5">
                    {idx > 0 && <ChevronRight size={12} className="text-txt-ghost shrink-0" />}
                    <span className={idx === crumbs.length - 1 ? 'text-txt-primary font-semibold' : 'truncate'}>
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isGuest && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => useGuestStore.getState().setRegistrationModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dv-gold/10 border border-dv-gold/20 text-dv-gold hover:bg-dv-gold/15 transition-colors"
              >
                <User size={12} />
                <span className="text-[10px] font-semibold">Гость</span>
              </motion.button>
            )}
            <DentCashHeaderChip />
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-muted hover:text-txt-primary hover:border-dv-gold/30 transition-colors text-xs"
            >
              <span>Поиск...</span>
              <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-3 rounded border border-bdr-subtle">⌘K</kbd>
            </button>
            <AlertDropdown
              alerts={proactiveAlerts}
              isOpen={alertDropdownOpen}
              setIsOpen={setAlertDropdownOpen}
            />
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

        <div className="flex-1 overflow-y-auto bg-surface-0 relative min-h-0 pb-16 md:pb-0">
          {/*
            No AnimatePresence/exit around Outlet: mode="wait" + opacity exit
            can leave the main pane at opacity:0 while the shell stays clickable
            (sidebar works, CRM body looks "frozen"/blank). Enter-only fade is enough.
          */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            <Outlet context={{ user, clinic, roleInfo }} />
          </motion.div>
        </div>
      </div>

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
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setContextSheetOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[85vh] bg-surface-1 border-t border-bdr-subtle rounded-t-2xl shadow-2xl flex flex-col"
            >
              <div
                className="flex h-12 items-center justify-center border-b border-bdr-subtle cursor-grab active:cursor-grabbing touch-pan-y"
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

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAIQuery={handleAIQuery} />
      {isMobile && <BottomNav />}
      <RegistrationModal />
    </div>
  );
};

export default IntelligenceLayout;
