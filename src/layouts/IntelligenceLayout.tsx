import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useGuestStore } from '@/store/guest.store';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { useAIStore } from '@/store/ai.store';
import { trackProductEvent } from '@/utils/analytics';
import { Sidebar } from './Sidebar';
import { AlertDropdown } from './AlertDropdown';
import { BottomNav } from './BottomNav';
import RegistrationModal from '@/components/guest/RegistrationModal';
import GuestCRMModal from '@/components/guest/GuestCRMModal';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { DentCashHeaderChip } from '@/components/wallet/DentCashHeaderChip';
import { useCompactShell } from '@/hooks/useCompactShell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ClinicalAIContextBridge } from '@/components/superapp/ClinicalAIContextBridge';
import EcosystemCaseFlow from '@/components/ecosystem/EcosystemCaseFlow';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';

const FIRST_RUN_COLLAPSE_MS = 15_000;

export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, roleInfo, logout } = useAuth();
  const { isGuest, isGuestRoute, requiresAuth, initGuest, showRegistrationModal, setRegistrationModal } = useGuestStore();
  const isMobile = useCompactShell();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarVisible,
    setSidebarVisible,
    sidebarOpen,
    setSidebarOpen,
    completeFirstRun,
    firstRunPhase,
    setFirstRunPhase,
  } = useUIStore();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const [guestCRMOpen, setGuestCRMOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const openTs = useRef(Date.now());
  const caseContext = useEcosystemUrlContext();
  const setAiQuery = useAIStore(s => s.setQuery);

  const isLoginRoute = ['/login', '/register', '/forgot-password', '/booking'].some(p => location.pathname.startsWith(p));
  const isCRMRoute = location.pathname.startsWith('/crm');
  const needsAuth = requiresAuth(location.pathname) && !isAuthenticated;

  const handleAIQuery = useCallback((query: string) => {
    setAiQuery(query);
    navigate('/ai');
  }, [navigate, setAiQuery]);

  useEffect(() => {
    if (firstRunPhase !== 'greeting') return;
    const timer = window.setTimeout(() => {
      completeFirstRun();
      setFirstRunPhase('done');
      setSidebarVisible(true);
      trackProductEvent('first_navigation', { target: location.pathname, t_ms: Date.now() - openTs.current });
    }, FIRST_RUN_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [location.pathname, firstRunPhase, completeFirstRun, setFirstRunPhase, setSidebarVisible]);

  useEffect(() => {
    if (firstRunPhase !== 'greeting' || !isAuthenticated || isLoginRoute) return;
    // The first-run shell must be an actual workspace, not a decorative timeout.
    // Keep the greeting/intro animation while ensuring the AI workspace is reachable immediately.
    if (location.pathname === '/') navigate('/ai', { replace: true });
  }, [firstRunPhase, isAuthenticated, isLoginRoute, location.pathname, navigate]);

  useEffect(() => {
    if (!isAuthenticated && !isGuest && !isLoginRoute) void initGuest();
  }, [isAuthenticated, isGuest, isLoginRoute, initGuest]);

  useEffect(() => {
    if (!needsAuth || !isGuest) return;
    if (isCRMRoute) {
      setGuestCRMOpen(true);
      return;
    }
    if (!showRegistrationModal) {
      const pendingPath = location.pathname;
      setRegistrationModal(true, () => navigate(pendingPath));
    }
  }, [needsAuth, isGuest, isCRMRoute, showRegistrationModal, location.pathname, setRegistrationModal, navigate]);

  if (needsAuth) {
    if (isGuest) {
      if (isCRMRoute) {
        return (
          <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><User size={22} /></div>
              <h2 className="text-xl font-semibold">DentVision CRM</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">Для доступа к рабочему пространству войдите или создайте аккаунт.</p>
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setGuestCRMOpen(true)}>Продолжить</button>
            </div>
            <GuestCRMModal open={guestCRMOpen} onClose={() => setGuestCRMOpen(false)} />
          </div>
        );
      }
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
    return <div className="fixed inset-0 z-50 grid place-items-center bg-surface-0"><div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" aria-label="Загрузка" /></div>;
  }

  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} sidebarVisible={sidebarVisible} isMobile={isMobile} sidebarOpen={sidebarOpen} user={user} roleInfo={roleInfo} logout={logout} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} isGuest={isGuest} />
      <div className={cn('min-h-screen transition-[padding] duration-300', sidebarVisible && !isMobile && (sidebarCollapsed ? 'pl-[76px]' : 'pl-[272px]'))}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--dv-border)] bg-[var(--dv-sidebar)]/95 px-4 backdrop-blur-xl">
          {isMobile && <button type="button" aria-label="Открыть меню" onClick={() => setSidebarOpen(true)} className="rounded-xl p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]"><Menu size={19} /></button>}
          <WorkspaceSwitcher />
          <div className="ml-auto flex items-center gap-2"><LanguageSwitcher /><AlertDropdown alerts={[]} isOpen={alertOpen} setIsOpen={setAlertOpen} /><DentCashHeaderChip /></div>
        </header>
        <main className="relative min-h-[calc(100vh-4rem)]">
          <ErrorBoundary><Outlet /></ErrorBoundary>
          <ClinicalAIContextBridge />
          {caseContext.patientId || caseContext.caseId ? <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 w-[min(760px,calc(100%-2rem))] -translate-x-1/2"><div className="pointer-events-auto"><EcosystemCaseFlow compact patientId={caseContext.patientId} caseId={caseContext.caseId} branchId={caseContext.branchId} organizationId={caseContext.organizationId} /></div></div> : null}
        </main>
      </div>
      {!isMobile && (
        <AnimatePresence>
          {contextSheetOpen && (
            <motion.aside initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 380, opacity: 0 }} className="fixed right-0 top-16 z-40 h-[calc(100vh-4rem)] w-[380px] border-l border-[var(--dv-border)] bg-[var(--dv-sidebar)] shadow-2xl">
              <ContextPanel />
            </motion.aside>
          )}
        </AnimatePresence>
      )}
      {isMobile && (
        <AnimatePresence>
          {contextSheetOpen && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl border-t border-[var(--dv-border)] bg-[var(--dv-sidebar)] p-3 shadow-2xl">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--dv-border)]" />
              <ContextPanel />
            </motion.div>
          )}
        </AnimatePresence>
      )}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAIQuery={handleAIQuery} />
      {isMobile && <BottomNav />}
      <RegistrationModal />
    </div>
  );
};

export default IntelligenceLayout;
