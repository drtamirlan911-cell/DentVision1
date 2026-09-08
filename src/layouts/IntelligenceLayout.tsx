import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ChevronRight, Menu, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useGuestStore } from '@/store/guest.store';
import { useWorkspaceStore } from '@/store/workspace.store';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette';
import { useAIStore } from '@/store/ai.store';
import { trackProductEvent } from '@/utils/analytics';
import { SuperAppSidebar } from './SuperAppSidebar';
import { AlertDropdown } from './AlertDropdown';
import { BottomNav } from './BottomNav';
import RegistrationModal from '@/components/guest/RegistrationModal';
import GuestCRMModal from '@/components/guest/GuestCRMModal';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { PlanAccessBanner } from '@/components/billing/PlanAccessBanner';
import { DentCashHeaderChip } from '@/components/wallet/DentCashHeaderChip';
import { useCompactShell } from '@/hooks/useCompactShell';
import { useQuery } from '@tanstack/react-query';
import * as api from '@/utils/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const FIRST_RUN_COLLAPSE_MS = 15_000;
const UUID_SEG_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { isGuest, isGuestRoute, requiresAuth, initGuest, retryGuest, initError, showRegistrationModal, setRegistrationModal } = useGuestStore();
  const { sidebarOpen, toggleSidebar, contextSheetOpen, setContextSheetOpen, sidebarCollapsed, setSidebarCollapsed, sidebarVisible, setSidebarVisible, sidebarHovering, setSidebarHovering, firstRunPhase, setFirstRunPhase, completeFirstRun, toggleSidebarCollapsed, crumbTailLabel } = useUIStore();
  const setOnboardingComplete = useWorkspaceStore((s) => s.setOnboardingComplete);
  const isPublicRoute = isGuestRoute(location.pathname);
  const needsAuth = requiresAuth(location.pathname) && !isAuthenticated;
  const isAIHome = location.pathname === '/';
  const proactiveAlerts = useAIStore((s) => s.proactiveAlerts);
  const loadProactiveAlerts = useAIStore((s) => s.loadProactiveAlerts);
  const isMobile = useCompactShell();
  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);
  const [guestCRMOpen, setGuestCRMOpen] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunBooted = useRef(false);
  const openTs = useRef(Date.now());

  const BREADCRUMB_LABELS: Record<string, string> = {
    crm: 'Practice', schedule: 'Schedule', patients: 'Patients', 'medical-card': 'Medical Card', finance: 'Finance', cashier: 'Cashier', inventory: 'Inventory', documents: 'Documents', 'dental-chart': 'Odontogram', 'treatment-plans': 'Treatment Plans', lab: 'Laboratory', pricelist: 'Price List', staff: 'Team', reminders: 'Reminders', promotions: 'Promotions', icd10: 'ICD-10', visits: 'Visits', supplier: 'Supplier', shop: 'Shop', school: 'Academy', 'school-workspace': 'Academy Workspace', 'center-workspace': 'Diagnostics', analytics: 'Analytics', bi: 'Business Intelligence', jobs: 'Jobs', community: 'Community', profile: 'Profile', 'clinic-settings': 'Clinic Settings', billing: 'Billing', settings: 'Settings', admin: 'Administration', audit: 'Audit & Security', backup: 'Backup', 'ai-approvals': 'AI Approvals', 'agent-activity': 'AI Agents', diagnostics: 'Diagnostics',
  };

  const clinicId = user?.clinicId || clinic?.id || null;
  const { data: billingSnap } = useQuery({
    queryKey: ['clinic-billing-access', clinicId],
    queryFn: () => api.getClinicBilling(),
    enabled: Boolean(clinicId) && isAuthenticated && !isGuest && Boolean(roleInfo?.canManageFinance),
    staleTime: 60_000,
    retry: 1,
  });

  const handleAIQuery = useCallback((query: string) => { navigate('/', { state: { aiQuery: query } }); }, [navigate]);

  const getBreadcrumbs = useCallback(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'AI Workspace', path: '/' }];
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]; accumulated += '/' + seg; const isLast = i === segments.length - 1;
      let label = BREADCRUMB_LABELS[seg] || seg;
      if (UUID_SEG_RE.test(seg)) label = (isLast && crumbTailLabel) || 'Record'; else if (isLast && crumbTailLabel && !BREADCRUMB_LABELS[seg]) label = crumbTailLabel;
      crumbs.push({ label, path: accumulated });
    }
    return crumbs;
  }, [location.pathname, crumbTailLabel]);

  useEffect(() => { if (!isMobile) setContextSheetOpen(false); }, [isMobile, setContextSheetOpen]);
  useEffect(() => { const timer = setTimeout(() => { void loadProactiveAlerts(); }, 500); return () => clearTimeout(timer); }, [loadProactiveAlerts]);

  useEffect(() => {
    if (!isGuest) return;
    setSidebarVisible(true); setSidebarCollapsed(false); setFirstRunPhase('done'); completeFirstRun(); setOnboardingComplete(true); firstRunBooted.current = true;
    if (!isMobile) setContextSheetOpen(true);
  }, [isGuest, isMobile, setSidebarVisible, setSidebarCollapsed, setFirstRunPhase, completeFirstRun, setOnboardingComplete, setContextSheetOpen]);

  useEffect(() => {
    if (isGuest || firstRunBooted.current) return;
    if (firstRunPhase === 'done') { setSidebarVisible(true); firstRunBooted.current = true; return; }
    firstRunBooted.current = true; setSidebarVisible(true); setSidebarCollapsed(false); setFirstRunPhase('dock');
    collapseTimerRef.current = setTimeout(() => { setSidebarCollapsed(true); setFirstRunPhase('done'); completeFirstRun(); }, FIRST_RUN_COLLAPSE_MS);
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
  }, [isGuest, firstRunPhase, setSidebarVisible, setSidebarCollapsed, setFirstRunPhase, completeFirstRun]);

  useEffect(() => { if (isAIHome) trackProductEvent('ai_workspace_opened'); }, [isAIHome]);
  useEffect(() => () => { void openTs.current; }, []);

  if (needsAuth) {
    if (isPublicRoute) {
      if (location.pathname.startsWith('/crm/schedule') && location.search.includes('demo=1')) {
        return <GuestCRMModal open={guestCRMOpen} onClose={() => { setGuestCRMOpen(false); navigate('/'); }} />;
      }
      return (
        <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-dv-gold/15 flex items-center justify-center"><User size={24} className="text-dv-gold" /></div>
            <h2 className="text-lg font-semibold text-txt-primary">Authentication required</h2>
            <p className="text-sm text-txt-secondary max-w-xs">Sign in to continue.</p>
            <button type="button" className="text-sm text-dv-gold hover:underline" onClick={() => setRegistrationModal(true, () => navigate(location.pathname))}>Open login</button>
          </div><RegistrationModal />
        </div>
      );
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex dv-app-surface">
      <AnimatePresence>
        {isMobile && sidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggleSidebar} />}
      </AnimatePresence>

      <div onMouseEnter={() => setSidebarHovering(true)} onMouseLeave={() => setSidebarHovering(false)} className="contents">
        <SuperAppSidebar
          collapsed={sidebarCollapsed}
          setCollapsed={(v) => { setSidebarCollapsed(v); if (!v) trackProductEvent('sidebar_user_expanded'); }}
          sidebarVisible={sidebarVisible}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          user={isGuest ? { id: 'guest', name: 'Guest', login: 'guest', role: 'guest', platformRole: 'guest' } as any : user}
          logout={isGuest ? () => {} : logout}
          toggleSidebar={toggleSidebar}
          isGuest={isGuest}
          pendingApprovals={0}
          isAdmin={Boolean(roleInfo?.pages?.includes('admin'))}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="dv-safe-header sticky top-0 z-30 flex items-center justify-between gap-2 min-h-[calc(var(--dv-topbar-height)+var(--dv-safe-top))] px-2.5 sm:px-4 md:px-6 bg-surface-0/60 backdrop-blur-xl border-b border-bdr-subtle flex-shrink-0 min-w-0 overflow-visible">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
            <button onClick={toggleSidebar} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-surface-2 transition-colors', !isMobile && 'hidden')} aria-label="Menu"><Menu size={18} /></button>
            {!isGuest && <WorkspaceSwitcher className="shrink-0" />}
            {isGuest && <motion.button whileTap={{ scale: 0.98 }} onClick={() => useGuestStore.getState().setRegistrationModal(true)} className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full bg-dv-gold/10 border border-dv-gold/20 text-dv-gold hover:bg-dv-gold/15 transition-colors"><User size={12} /><span className="text-[10px] font-semibold">Guest</span></motion.button>}
            <div className="hidden sm:block h-4 w-px bg-bdr-subtle shrink-0" />
            <div className="min-w-0 overflow-hidden flex-1"><div className="flex items-center gap-1.5 text-sm text-txt-muted overflow-hidden whitespace-nowrap">{getBreadcrumbs().map((crumb, idx, crumbs) => <span key={crumb.path} className="flex items-center gap-1.5 min-w-0 max-w-full">{idx > 0 && <ChevronRight size={12} className="text-txt-ghost shrink-0" />}<span className={cn('truncate', idx === crumbs.length - 1 ? 'text-txt-primary font-semibold' : 'hidden md:inline')}>{crumb.label}</span></span>)}</div></div>
          </div>
          <div className="flex items-center gap-2 shrink-0"><LanguageSwitcher /><DentCashHeaderChip /><AlertDropdown open={alertDropdownOpen} onOpenChange={setAlertDropdownOpen} alerts={proactiveAlerts} /></div>
        </header>
        {billingSnap && <PlanAccessBanner snapshot={billingSnap} />}
        <main className="flex-1 min-h-0 overflow-auto dv-page"><ErrorBoundary><Outlet /></ErrorBoundary></main>
      </div>
      {!isMobile && contextSheetOpen && <ContextPanel open={contextSheetOpen} onClose={() => setContextSheetOpen(false)} />}
      <BottomNav />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onAIQuery={handleAIQuery} />
      <RegistrationModal />
    </div>
  );
};

export default IntelligenceLayout;
