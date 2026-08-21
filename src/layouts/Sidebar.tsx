import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope, ChevronLeft, ChevronRight, LogOut, Brain,
  ShoppingCart, GraduationCap, Briefcase, BarChart3, Users, User,
  Shield, ShieldCheck, FileText, Database, Settings, FlaskConical, Star, LogIn, Store, Activity, Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/ds/Avatar';
import { Badge } from '@/components/ui/ds/Badge';
import { Tooltip } from '@/components/ui/ds/Tooltip';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { useAuth, useAuthStore } from '@/store/auth.store';
import { firstAllowedCrmPath } from '@/lib/roleAccess';
import { useIam } from '@/iam';
import { useGuestStore } from '@/store/guest.store';
import { Logo } from '@/components/brand';
import type { User as UserType, RoleInfo } from '@/types';

/**
 * The single route behind the diagnostics workspace entry.
 *
 * `/center-workspace` and `/diagnostics/lab-dashboard` both still resolve —
 * deep links and the superadmin's own navigation rely on them — but the sidebar
 * points at one, and the workspace resolves centre vs laboratory from
 * membership rather than from which link was pressed.
 */
const DIAGNOSTICS_WORKSPACE_PATH = '/center-workspace';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string | number;
  color?: string;
  section?: 'services' | 'platform';
}

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  sidebarVisible: boolean;
  isMobile: boolean;
  sidebarOpen: boolean;
  user: UserType | null;
  roleInfo: RoleInfo | null;
  logout: () => void;
  toggleSidebar: () => void;
  isGuest?: boolean;
  onToggleCollapsed?: () => void;
}

function NavIconChip({
  color,
  active,
  collapsed,
  children,
}: {
  color: string;
  active: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center transition-all duration-200',
        collapsed ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg',
      )}
      style={{
        color: active ? color : undefined,
        background: active
          ? `linear-gradient(145deg, ${color}28 0%, ${color}12 100%)`
          : collapsed
            ? 'rgba(255,255,255,0.035)'
            : `${color}14`,
        boxShadow: active
          ? `inset 0 0 0 1px ${color}40, 0 0 18px ${color}18`
          : collapsed
            ? 'inset 0 0 0 1px rgba(255,255,255,0.04)'
            : `inset 0 0 0 1px ${color}18`,
      }}
    >
      {children}
    </span>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed, setCollapsed, sidebarVisible, isMobile, sidebarOpen,
  user, roleInfo, logout, toggleSidebar, isGuest = false, onToggleCollapsed,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [crmOpen, setCrmOpen] = React.useState(location.pathname.startsWith('/crm'));
  const sidebarWidth = !sidebarVisible && !isMobile ? 0 : (collapsed ? 76 : 248);
  const { user: authUser, role: authRole, roleInfo: authRoleInfo, activeMembership } = useAuth();
  const iam = useIam();
  const clinicId = authUser?.clinicId || '';
  const { t } = useTranslation();

  const NAV_ITEMS: NavItem[] = [
    { id: 'crm', label: 'CRM', icon: <Stethoscope size={18} strokeWidth={1.75} />, path: '/crm/schedule', color: '#C9A96E', section: 'services' },
    { id: 'diagnostics', label: t('nav.diagnostics'), icon: <Activity size={18} strokeWidth={1.75} />, path: '/diagnostics', color: '#27AE60', section: 'services' },
    { id: 'shop', label: t('nav.shop'), icon: <ShoppingCart size={18} strokeWidth={1.75} />, path: '/shop', color: '#A78BFA', section: 'services' },
    { id: 'school', label: 'Academy OS', icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school', color: '#2DD4BF', section: 'services' },
    { id: 'analytics', label: t('nav.analytics'), icon: <BarChart3 size={18} strokeWidth={1.75} />, path: '/analytics', color: '#FBBF24', section: 'services' },
    { id: 'bi', label: t('nav.bi'), icon: <BarChart3 size={18} strokeWidth={1.75} />, path: '/bi', color: '#10B981', section: 'services' },
    { id: 'jobs', label: t('nav.jobs'), icon: <Briefcase size={18} strokeWidth={1.75} />, path: '/jobs', color: '#FB923C', section: 'services' },
    { id: 'community', label: t('nav.community'), icon: <Users size={18} strokeWidth={1.75} />, path: '/community', color: '#38BDF8', section: 'services' },
    { id: 'supplier', label: t('nav.supplier_cabinet'), icon: <Store size={18} strokeWidth={1.75} />, path: '/supplier', color: '#34D399', section: 'platform' },
    { id: 'school-workspace', label: t('nav.school_workspace'), icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school-workspace', color: '#2DD4BF', section: 'platform' },
    // One entry, not two: since the centre and laboratory dashboards were
    // merged (#183) both led to the same screen with a different `kind`, and
    // both were shown to every user — a clinic doctor saw two workspaces they
    // are not a partner of. Which one opens is decided by membership.
    { id: 'diagnostics-workspace', label: t('nav.diagnostics_workspace'), icon: <FlaskConical size={18} strokeWidth={1.75} />, path: '/center-workspace', color: '#27AE60', section: 'platform' },
    { id: 'profile', label: t('nav.profile'), icon: <User size={18} strokeWidth={1.75} />, path: '/profile', color: '#60A5FA', section: 'platform' },
    { id: 'partner-legal', label: t('nav.partner_legal'), icon: <FileText size={18} strokeWidth={1.75} />, path: '/partner-legal', color: '#C9A96E', section: 'platform' },
    { id: 'audit', label: t('nav.audit'), icon: <FileText size={18} strokeWidth={1.75} />, path: '/audit', color: '#FBBF24', section: 'platform' },
    { id: 'backup', label: t('nav.backup'), icon: <Database size={18} strokeWidth={1.75} />, path: '/backup', color: '#38BDF8', section: 'platform' },
    { id: 'settings', label: t('nav.settings'), icon: <Settings size={18} strokeWidth={1.75} />, path: '/settings', color: '#94A3B8', section: 'platform' },
  ];

  const ADMIN_ITEMS: NavItem[] = [
    { id: 'admin', label: t('nav.admin'), icon: <Shield size={18} strokeWidth={1.75} />, path: '/admin', color: '#F87171', section: 'platform' },
    { id: 'shop-admin', label: t('nav.shop_admin'), icon: <ShoppingCart size={18} strokeWidth={1.75} />, path: '/shop/admin', color: '#A78BFA', section: 'platform' },
    { id: 'school-admin', label: t('nav.school_admin'), icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school/admin', color: '#2DD4BF', section: 'platform' },
    { id: 'security', label: t('nav.security'), icon: <ShieldCheck size={18} strokeWidth={1.75} />, path: '/security', color: '#38BDF8', section: 'platform' },
    { id: 'legal', label: t('nav.legal'), icon: <Scale size={18} strokeWidth={1.75} />, path: '/legal', color: '#C9A96E', section: 'platform' },
    { id: 'quality', label: t('nav.quality'), icon: <Activity size={18} strokeWidth={1.75} />, path: '/admin?tab=quality', color: '#10B981', section: 'platform', badge: 'NEW' },
  ];

  const GUEST_NAV_ITEMS: NavItem[] = [
    { id: 'demo', label: t('nav.demo'), icon: <FlaskConical size={18} strokeWidth={1.75} />, path: '/crm/schedule?demo=1', color: '#C9A96E', section: 'services' },
    { id: 'shop', label: t('nav.shop'), icon: <ShoppingCart size={18} strokeWidth={1.75} />, path: '/shop', color: '#A78BFA', section: 'services' },
    { id: 'school', label: 'Academy OS', icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school', color: '#2DD4BF', section: 'services' },
    { id: 'jobs', label: t('nav.jobs'), icon: <Briefcase size={18} strokeWidth={1.75} />, path: '/jobs', color: '#FB923C', section: 'services' },
    { id: 'community', label: t('nav.community'), icon: <Users size={18} strokeWidth={1.75} />, path: '/community', color: '#38BDF8', section: 'services' },
    { id: 'pricing', label: t('nav.pricing'), icon: <Star size={18} strokeWidth={1.75} />, path: '/pricing', color: '#FBBF24', section: 'platform' },
  ];

  const CRM_SUBNAV = {
    sections: [
      {
        label: t('nav.section_patients'),
        items: [
          { id: 'schedule', label: t('nav.schedule'), path: '/crm/schedule' },
          { id: 'patients', label: t('nav.patients'), path: '/crm/patients' },
          { id: 'visits', label: t('nav.visits'), path: '/crm/visits' },
          { id: 'medical-card', label: t('nav.medical_card'), path: '/crm/medical-card' },
          { id: 'dental-chart', label: t('nav.dental_chart'), path: '/crm/dental-chart' },
          { id: 'treatment-plans', label: t('nav.treatment_plans'), path: '/crm/treatment-plans' },
          { id: 'documents', label: t('nav.documents'), path: '/crm/documents' },
          { id: 'icd10', label: t('nav.icd10'), path: '/crm/icd10' },
        ],
      },
      {
        label: t('nav.section_finance'),
        items: [
          { id: 'finance', label: t('nav.finance'), path: '/crm/finance' },
          { id: 'pricelist', label: t('nav.pricelist'), path: '/crm/pricelist' },
          { id: 'inventory', label: t('nav.inventory'), path: '/crm/inventory' },
          { id: 'lab', label: t('nav.lab'), path: '/crm/lab' },
          { id: 'promotions', label: t('nav.promotions'), path: '/crm/promotions' },
        ],
      },
      {
        label: t('nav.section_management'),
        items: [
          { id: 'staff', label: t('nav.staff'), path: '/crm/staff' },
          { id: 'reminders', label: t('nav.reminders'), path: '/crm/reminders' },
          { id: 'workflow', label: t('nav.workflow'), path: '/crm/workflow' },
        ],
      },
      {
        label: t('nav.section_admin'),
        adminOnly: true,
        items: [
          { id: 'patient-inbox', label: t('nav.patient_inbox'), path: '/crm/patient-inbox' },
          { id: 'clinic-settings', label: t('nav.clinic_settings'), path: '/crm/clinic-settings' },
          { id: 'billing', label: t('nav.billing'), path: '/crm/billing' },
          { id: 'integrations', label: t('nav.integrations'), path: '/crm/integrations/messaging' },
        ],
      },
    ],
  };

  React.useEffect(() => {
    if (location.pathname.startsWith('/crm')) setCrmOpen(true);
  }, [location.pathname]);

  const isAdmin = iam.pages.includes('admin');
  const showClinicSettings = iam.can('canManageClinicSettings');

  const prefetchFor = useCallback((id: string) => {
    if ((id === 'crm' || id === 'analytics') && (!clinicId || isGuest)) return;
    switch (id) {
      case 'crm':
        queryClient.prefetchQuery({ queryKey: queryKeys.patients, queryFn: () => api.getPatients(clinicId), staleTime: 60_000 });
        queryClient.prefetchQuery({ queryKey: queryKeys.appointments, queryFn: () => api.getAppointments(clinicId), staleTime: 60_000 });
        break;
      case 'shop':
        queryClient.prefetchQuery({ queryKey: [...queryKeys.products], queryFn: () => api.getShopProducts(), staleTime: 60_000 });
        break;
      case 'school':
        queryClient.prefetchQuery({ queryKey: [...queryKeys.courses], queryFn: () => api.getSchoolCourses(), staleTime: 60_000 });
        break;
      case 'analytics':
        queryClient.prefetchQuery({ queryKey: queryKeys.receipts, queryFn: () => api.getReceipts(clinicId), staleTime: 60_000 });
        break;
    }
  }, [queryClient, clinicId, isGuest]);

  const isSuperAdmin = authRole === 'superadmin';

  // Stash the current clinic token before switching to a workspace context
  // so navigating back to CRM/clinic pages can auto-restore full permissions.
  const saveClinicContext = () => {
    try {
      const stored = api.loadTokens();
      if (stored) localStorage.setItem('dv_clinic_backup', JSON.stringify(stored));
    } catch { /* ignore */ }
  };
  const restoreClinicIfNeeded = async () => {
    if (!authUser?.organizationType || authUser.organizationType === 'CLINIC') return;
    try {
      const raw = localStorage.getItem('dv_clinic_backup');
      if (!raw) return;
      const { accessToken, refreshToken } = JSON.parse(raw);
      api.setTokens(accessToken, refreshToken || null);
      await useAuthStore.getState().restoreSession();
    } catch { /* ignore */ }
  };

  const serviceItems = isSuperAdmin ? NAV_ITEMS : (isGuest ? GUEST_NAV_ITEMS : NAV_ITEMS.filter(item => {
    if (item.id === 'crm') return true;
    if (item.id === 'profile' || item.id === 'settings' || item.id === 'partner-legal' || item.id === 'diagnostics') return true;
    if (item.id === 'supplier' || item.id === 'school-workspace' || item.id === 'diagnostics-workspace') return true;
    if (item.id === 'jobs' || item.id === 'community') return true;
    if (item.id === 'shop') return iam.pages.length === 0 || iam.canAccessPage('shop');
    if (item.id === 'school') return iam.pages.length === 0 || iam.canAccessPage('school');
    if (item.id === 'analytics') return iam.canAccessPage('analytics');
    if (item.id === 'bi') {
      const r = String(authRole || '').toLowerCase();
      return r === 'owner' || r === 'director' || r === 'superadmin';
    }
    return iam.canAccessPage(item.id) || iam.pages.length === 0;
  }));

  const visibleCrmSections = CRM_SUBNAV.sections.map((section) => {
    const visibleItems = section.items.filter((sub) => {
      if (section.adminOnly) {
        return showClinicSettings || iam.canAccessPage(sub.id);
      }
      if (!iam.pages.length) return false;
      return iam.canAccessPage(sub.id);
    });
    return { ...section, items: visibleItems };
  }).filter((s) => s.items.length > 0);

  // Pick the first CRM page the role may open instead of always landing on schedule.
  const crmEntryPath = (() => {
    for (const s of visibleCrmSections) {
      if (s.items.length > 0) return s.items[0].path;
    }
    return firstAllowedCrmPath(iam.pages);
  })();

  const handleNavClick = async (path: string) => {
    if (isGuest) {
      const publicPaths = ['/shop', '/school', '/jobs', '/community', '/demo', '/pricing', '/', '/crm'];
      if (publicPaths.some(p => path === p || path.startsWith(p + '/'))) {
        navigate(path);
      } else {
        useGuestStore.getState().setRegistrationModal(true, () => navigate(path));
      }
    } else {
      // Any navigation into CRM / clinic pages restores the original clinic
      // context when we're currently in a workspace (center/lab/supplier).
      if (path.startsWith('/crm') || path === '/analytics' || path === '/bi') {
        await restoreClinicIfNeeded();
      }
      navigate(path);
    }
    if (isMobile && sidebarOpen) toggleSidebar();
  };

  /**
   * Open whichever diagnostics workspace this user actually belongs to.
   *
   * A laboratory member used to get a plain navigate — only the centre entry
   * carried the context switch — so they landed on the workspace without ever
   * switching into their own organisation. Both types now take the same path,
   * and a user who belongs to neither lands on the screen that offers the two
   * ways in.
   */
  const handleDiagnosticsWorkspaceClick = async () => {
    const inOrg = authUser?.organizationType === 'DIAGNOSTIC_CENTER' || authUser?.organizationType === 'LABORATORY';
    if (inOrg) { handleNavClick(DIAGNOSTICS_WORKSPACE_PATH); return; }
    try {
      const res = await api.getMyContexts();
      const ctx = (res.contexts || []).find((c: any) => c.scopeType === 'DIAGNOSTIC_CENTER' || c.scopeType === 'LABORATORY');
      if (ctx?.scopeId) {
        const tok = await api.switchContext(ctx.scopeType, ctx.organizationId || ctx.scopeId);
        if (tok?.accessToken) {
          saveClinicContext();
          api.setTokens(tok.accessToken, tok.refreshToken || null);
          await useAuthStore.getState().restoreSession();
          navigate(DIAGNOSTICS_WORKSPACE_PATH);
          return;
        }
      }
    } catch { /* fall through to the page */ }
    handleNavClick(DIAGNOSTICS_WORKSPACE_PATH);
  };

  const renderNavSection = (items: NavItem[], sectionLabel?: string) => (
    <>
      {!collapsed && sectionLabel && (
        <div className="pt-4 pb-1.5 px-1">
          <p className="text-[10px] font-semibold text-txt-ghost uppercase tracking-[0.14em]">{sectionLabel}</p>
        </div>
      )}
      {collapsed && sectionLabel && (
        <div className="my-2 mx-auto h-px w-7 rounded-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      )}
      {items.map(item => {
        const isCrm = item.id === 'crm';
        const color = item.color || '#C9A96E';
        const isActive = isCrm
          ? location.pathname.startsWith('/crm')
          : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        const btn = (
          <motion.button
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (isCrm && !collapsed) {
                setCrmOpen((v) => !v);
                if (!location.pathname.startsWith('/crm')) handleNavClick(crmEntryPath);
              } else if (item.id === 'diagnostics-workspace') {
                handleDiagnosticsWorkspaceClick();
              } else {
                handleNavClick(item.path);
              }
            }}
            onMouseEnter={() => prefetchFor(item.id)}
            whileHover={collapsed ? { scale: 1.04 } : { x: 2 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'group relative flex w-full items-center transition-colors duration-150',
              collapsed ? 'justify-center py-1' : 'gap-3 rounded-xl px-2 py-1.5',
              !collapsed && (isActive
                ? 'bg-white/[0.05]'
                : 'hover:bg-white/[0.035]'),
            )}
          >
            {!collapsed && isActive && (
              <span
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}80` }}
              />
            )}
            <NavIconChip color={color} active={isActive} collapsed={collapsed}>
              <span className={cn('transition-colors', !isActive && 'text-txt-muted group-hover:text-txt-secondary')}>
                {item.icon}
              </span>
            </NavIconChip>
            {!collapsed && (
              <>
                <span className={cn(
                  'text-[13px] truncate flex-1 text-left font-medium tracking-tight',
                  isActive ? 'text-txt-primary' : 'text-txt-secondary group-hover:text-txt-primary',
                )}>
                  {item.label}
                </span>
                {item.badge && (
                  <Badge variant="gold" size="xs">{item.badge}</Badge>
                )}
                {isCrm && (
                  <ChevronRight
                    size={13}
                    className={cn(
                      'text-txt-ghost transition-transform duration-200',
                      crmOpen && 'rotate-90',
                    )}
                  />
                )}
              </>
            )}
          </motion.button>
        );
        return (
          <Tooltip key={item.id} content={collapsed ? item.label : undefined} side="right">
            <div className={cn(collapsed && 'flex justify-center')}>
              {btn}
              {isCrm && !collapsed && crmOpen && !isGuest && (
                <div className="ml-4 mt-1 mb-1.5 space-y-1 border-l border-white/[0.07] pl-2.5">
                  {visibleCrmSections.map((section) => (
                    <div key={section.label} className="mb-1">
                      <p className="text-[10px] font-semibold text-txt-ghost uppercase tracking-[0.10em] px-2.5 py-1">
                        {section.label}
                      </p>
                      {section.items.map((sub) => {
                        const subActive = location.pathname === sub.path || location.pathname.startsWith(sub.path + '/');
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            aria-current={subActive ? 'page' : undefined}
                            onClick={() => handleNavClick(sub.path)}
                            className={cn(
                              'w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] transition-colors',
                              subActive
                                ? 'text-dv-gold bg-dv-gold/10 font-medium'
                                : 'text-txt-muted hover:text-txt-primary hover:bg-white/[0.04]',
                            )}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {visibleCrmSections.length === 0 && (
                    <p className="px-2.5 py-1.5 text-[10px] text-txt-ghost">{t('nav.no_sections')}</p>
                  )}
                </div>
              )}
            </div>
          </Tooltip>
        );
      })}
    </>
  );

  const intelligenceActive = location.pathname === '/';

  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarWidth,
        x: isMobile ? (sidebarOpen ? 0 : -Math.max(sidebarWidth, 76)) : 0,
        // On mobile the drawer must stay visible while open even if first-run
        // sidebarVisible is still false.
        opacity: isMobile || sidebarVisible ? 1 : 0,
      }}
      transition={{ type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'h-full flex flex-col flex-shrink-0 z-50 relative overflow-hidden origin-left',
        'border-r border-white/[0.05]',
        isMobile && 'fixed top-0 left-0 bottom-0 dv-safe-sidebar',
        !sidebarVisible && !isMobile && 'pointer-events-none border-transparent',
      )}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth,
        background: 'linear-gradient(180deg, var(--dv-sidebar-bg) 0%, var(--dv-sidebar-bg-end) 100%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--dv-sidebar-glow-gold) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-24 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--dv-sidebar-glow-blue) 0%, transparent 70%)' }}
        />
      </div>

      {/* Brand */}
      <div
        className={cn(
          'relative flex h-14 flex-shrink-0 border-b border-white/[0.05]',
          collapsed ? 'items-center justify-center px-1' : 'items-center justify-between px-3.5',
        )}
      >
        <div className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-2.5')}>
          <Logo
            variant={collapsed ? 'icon' : 'compact'}
            height={collapsed ? 34 : 30}
            responsive={false}
            title="DentVision"
          />
        </div>
        {!isGuest && (
          <button
            type="button"
            onClick={() => (onToggleCollapsed ? onToggleCollapsed() : setCollapsed(!collapsed))}
            className={cn(
              'items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors',
              isMobile ? 'hidden' : 'flex',
              collapsed
                ? 'absolute right-1 top-1 h-6 w-6'
                : 'h-7 w-7 shrink-0',
            )}
            aria-label={collapsed ? t('nav.expand_sidebar') : t('nav.collapse_sidebar')}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="relative px-3.5 py-3 border-b border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={isGuest ? t('nav.guest') : (user?.name || user?.login || '?')}
              size="sm"
              src={isGuest ? undefined : ((user as any)?.photoUrl || (user as any)?.avatar || undefined)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-txt-primary truncate">{isGuest ? t('nav.guest') : (user?.name || user?.login)}</p>
              <p className="text-[10px] text-txt-muted truncate">{isGuest ? t('nav.anonymous_access') : ((roleInfo as any)?.label || t('nav.employee'))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Intelligence — always first in the vertical stack */}
      <div className={cn('relative pt-3 flex-shrink-0', collapsed ? 'px-2' : 'px-2.5')}>
        <Tooltip content={collapsed ? 'Intelligence' : undefined} side="right">
          <motion.button
            type="button"
            onClick={() => handleNavClick('/')}
            whileHover={collapsed ? { scale: 1.04 } : { scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex w-full items-center transition-all duration-200',
              collapsed ? 'justify-center' : 'gap-3 rounded-xl px-2 py-2',
              !collapsed && (intelligenceActive
                ? 'bg-dv-gold/12'
                : 'hover:bg-white/[0.035]'),
            )}
          >
            <span
              className={cn(
                'relative flex shrink-0 items-center justify-center transition-all duration-200',
                collapsed ? 'h-11 w-11 rounded-2xl' : 'h-9 w-9 rounded-xl',
              )}
              style={{
                color: '#C9A96E',
                background: intelligenceActive
                  ? 'linear-gradient(145deg, rgba(201,169,110,0.35), rgba(201,169,110,0.12))'
                  : 'linear-gradient(145deg, var(--dv-sidebar-brand-bg), rgba(201,169,110,0.06))',
                boxShadow: intelligenceActive
                  ? 'inset 0 0 0 1px var(--dv-sidebar-brand-border), 0 0 22px rgba(201,169,110,0.22)'
                  : 'inset 0 0 0 1px rgba(201,169,110,0.22)',
              }}
            >
              <Brain size={collapsed ? 20 : 17} strokeWidth={1.75} />
            </span>
            {!collapsed && (
              <div className="text-left min-w-0">
                <p className={cn('text-[13px] font-semibold truncate', intelligenceActive ? 'text-dv-gold' : 'text-txt-primary')}>
                  Intelligence
                </p>
                <p className="text-[10px] text-txt-muted truncate">{t('nav.digital_assistant')}</p>
              </div>
            )}
          </motion.button>
        </Tooltip>
      </div>

      {!collapsed && isGuest && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
          <div className="rounded-xl border border-dv-gold/20 bg-gradient-to-br from-dv-gold/10 via-dv-gold/5 to-transparent p-3 space-y-2">
            <p className="text-xs font-semibold text-txt-primary">{t('platform.guest_onboarding_title')}</p>
            <p className="text-[11px] text-txt-muted leading-relaxed">
              {t('platform.guest_onboarding_desc')}
            </p>
            <button
              type="button"
              onClick={() => handleNavClick('/crm/schedule?demo=1')}
              className="w-full rounded-lg bg-dv-gold px-3 py-1.5 text-xs font-semibold text-dv-gold-on hover:bg-dv-gold/90 transition-colors"
            >
              {t('platform.guest_onboarding_btn')}
            </button>
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="px-3.5 pt-4 pb-1 flex-shrink-0">
          <p className="text-[10px] font-semibold text-txt-ghost uppercase tracking-[0.14em]">
            {isGuest ? t('common.open') : t('nav.services')}
          </p>
        </div>
      )}

      {collapsed && (
        <div className="my-2.5 mx-auto h-px w-8 rounded-full bg-gradient-to-r from-transparent via-dv-gold/35 to-transparent flex-shrink-0" />
      )}

      <motion.nav
        aria-label={t('nav.main_nav')}
        initial="hidden"
        animate={sidebarVisible ? 'visible' : 'hidden'}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.03, delayChildren: 0.06 } },
        }}
        className={cn(
          'relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar',
          collapsed ? 'px-2 space-y-1 py-0.5' : 'px-2.5 space-y-0.5 py-0.5',
        )}
      >
        {isGuest
          ? renderNavSection(GUEST_NAV_ITEMS)
          : <>
            {renderNavSection(serviceItems.filter(i => i.section !== 'platform'))}
            {renderNavSection(serviceItems.filter(i => i.section === 'platform'), t('nav.platform'))}
            {(isAdmin || isSuperAdmin) && renderNavSection(ADMIN_ITEMS, t('nav.administration'))}
          </>
        }
      </motion.nav>

      {/* Footer actions — pinned bottom of the vertical stack */}
      <div className={cn('relative pb-3 pt-2 flex-shrink-0 space-y-1.5', collapsed ? 'px-2' : 'px-2.5')}>
        <div className="mx-auto mb-1.5 h-px w-full max-w-[9rem] rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {!isGuest && user ? (
          <Tooltip content={collapsed ? t('auth.logout') : undefined} side="right">
            <motion.button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              whileHover={collapsed ? { scale: 1.04 } : undefined}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex w-full items-center rounded-xl border border-error/15 text-error transition-colors hover:bg-error/10',
                collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2',
              )}
            >
              <LogOut size={16} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{t('auth.logout')}</span>}
            </motion.button>
          </Tooltip>
        ) : (
          <Tooltip content={collapsed ? t('auth.login') : undefined} side="right">
            <motion.button
              type="button"
              onClick={() => navigate('/login')}
              whileHover={collapsed ? { scale: 1.04 } : undefined}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex w-full items-center rounded-xl border border-dv-gold/25 text-dv-gold transition-colors hover:bg-dv-gold/10',
                collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2',
              )}
            >
              <LogIn size={16} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{t('auth.login')}</span>}
            </motion.button>
          </Tooltip>
        )}
      </div>
    </motion.aside>
  );
};
