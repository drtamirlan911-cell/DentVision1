import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ShoppingCart, Bot, Activity, MoreHorizontal, Building2, Store, GraduationCap, BriefcaseBusiness, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, type WorkspaceContext } from '@/store/auth.store';
import { getWorkspaceHomeTarget, isClinicFinanceOnlyRole, isWorkspaceNavigationActive } from '@/lib/workspaceNavigation';
import { firstAllowedCrmPath } from '@/lib/roleAccess';
import { useGuestStore } from '@/store/guest.store';
import { useUIStore } from '@/store/ui.store';
import { useIam } from '@/iam';

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  color: string;
  requiresAuth?: boolean;
  onClick?: () => void;
}

/** Resolve the active cabinet's mobile return destination without guessing another membership. */
export function resolveBottomNavWorkspaceHomePath(
  workspace: Pick<WorkspaceContext, 'scopeType' | 'roleKey' | 'role'> | null | undefined,
  pages: readonly string[] = [],
): string | null {
  if (!workspace) return null
  const target = getWorkspaceHomeTarget({
    scopeType: workspace.scopeType,
    roleKey: workspace.roleKey || workspace.role,
    hasClinic: workspace.scopeType === 'CLINIC',
  })
  if (!target) return null
  if (target.scopeType === 'CLINIC') {
    if (isClinicFinanceOnlyRole(workspace.roleKey || workspace.role)
      && (pages.includes('cashier') || pages.includes('finance'))) return '/crm/cashier'
    if (pages.length > 0) {
      const allowedPath = firstAllowedCrmPath([...pages])
      if (allowedPath !== '/') return allowedPath
    }
  }
  return target.path
}

function workspaceCabinetIcon(scopeType?: string | null): React.ReactNode {
  switch (String(scopeType || '').toUpperCase()) {
    case 'CLINIC': return <Stethoscope size={19} />
    case 'DIAGNOSTIC_CENTER':
    case 'LABORATORY':
    case 'MEDICAL_LAB':
    case 'MEDICAL_LABORATORY':
    case 'DENTAL_LAB':
    case 'DENTAL_LABORATORY': return <FlaskConical size={19} />
    case 'SUPPLIER':
    case 'SUPPLIER_COMPANY': return <Store size={19} />
    case 'LECTURER':
    case 'ACADEMY': return <GraduationCap size={19} />
    case 'EMPLOYER': return <BriefcaseBusiness size={19} />
    default: return <Building2 size={19} />
  }
}

export function shouldShowDiagnosticWorkspaceTab(
  isAuthenticated: boolean,
  isGuest: boolean,
  hasUnselectedMemberships: boolean,
  hasPartnerWorkspace: boolean,
  canAccessDiagnostics: boolean,
): boolean {
  return isAuthenticated && !isGuest && !hasUnselectedMemberships
    && !hasPartnerWorkspace && canAccessDiagnostics
}

/** Keep consumer and non-clinic contexts out of the clinic CRM tab. */
export function shouldShowClinicWorkspaceTab(
  isAuthenticated: boolean,
  isGuest: boolean,
  canAccessSchedule: boolean,
): boolean {
  return !isAuthenticated || isGuest || canAccessSchedule;
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, activeWorkspace, workspaceContexts, pages } = useAuth();
  const { isGuest, setRegistrationModal } = useGuestStore();
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const { t } = useTranslation();
  const iam = useIam();

  const ITEMS: BottomNavItem[] = useMemo(() => {
    const activeScope = String(activeWorkspace?.scopeType || '').toUpperCase();
    const hasUnselectedMemberships = !activeWorkspace && workspaceContexts.length > 0;
    const hasPartnerWorkspace = Boolean(activeWorkspace && activeScope !== 'CLINIC');
    const canAccessClinicWorkspace = activeWorkspace
      ? activeScope === 'CLINIC' && iam.canAccessPage('schedule')
      : !hasUnselectedMemberships && shouldShowClinicWorkspaceTab(
        isAuthenticated,
        isGuest,
        iam.canAccessPage('schedule'),
      );
    const items: BottomNavItem[] = [
      { id: 'ai', label: t('nav.ai_short', 'ИИ'), icon: <Bot size={19} />, path: '/ai', color: '#A47B35' },
    ];

    if (activeWorkspace) {
      const homePath = resolveBottomNavWorkspaceHomePath(activeWorkspace, pages);
      items.push({
        id: 'cabinet',
        label: activeScope === 'CLINIC' ? t('nav.crm', 'Клиника') : 'Кабинет',
        icon: workspaceCabinetIcon(activeScope),
        path: homePath || undefined,
        color: '#A47B35',
        requiresAuth: true,
        onClick: homePath ? undefined : () => window.dispatchEvent(new CustomEvent('dentvision:open-workspace-switcher')),
      });
    } else if (hasUnselectedMemberships) {
      items.push({
        id: 'cabinet',
        label: 'Кабинет',
        icon: <Building2 size={19} />,
        color: '#A47B35',
        requiresAuth: true,
        onClick: () => window.dispatchEvent(new CustomEvent('dentvision:open-workspace-switcher')),
      });
    } else if (canAccessClinicWorkspace) {
      items.push({
        id: 'crm',
        label: t('nav.crm', 'Клиника'),
        icon: <Stethoscope size={19} />,
        path: '/crm/schedule',
        color: '#A47B35',
        requiresAuth: true,
      });
    }

    // A partner cabinet already provides its own return destination. Do not
    // add clinic or diagnostic shortcuts from stale global permissions.
    if (shouldShowDiagnosticWorkspaceTab(isAuthenticated, isGuest, hasUnselectedMemberships, hasPartnerWorkspace, iam.canAccessPage('diagnostics'))) {
      const clinicTabIndex = items.findIndex((item) => item.id === 'crm' || item.id === 'cabinet');
      items.splice(clinicTabIndex >= 0 ? clinicTabIndex + 1 : 1, 0, {
        id: 'diagnostics',
        label: t('nav.diagnostics', 'Диагностика'),
        icon: <Activity size={19} />,
        path: '/diagnostics',
        color: '#A47B35',
        requiresAuth: true,
      });
    }

    items.push(
      { id: 'shop', label: t('nav.market', 'Маркет'), icon: <ShoppingCart size={19} />, path: '/shop', color: '#A47B35' },
      { id: 'more', label: t('nav.more', 'Ещё'), icon: <MoreHorizontal size={20} />, color: '#A47B35' },
    );
    return items;
  }, [activeWorkspace, workspaceContexts, pages, iam, isAuthenticated, isGuest, t]);

  const handleNavClick = useCallback((item: BottomNavItem) => {
    if (item.onClick) {
      item.onClick();
      return;
    }
    if (item.id === 'more') {
      toggleSidebar();
      return;
    }
    if (item.id === 'crm' && (!isAuthenticated || isGuest)) {
      navigate('/crm/schedule?demo=1');
      return;
    }
    if (item.requiresAuth && !isAuthenticated && !isGuest) {
      setRegistrationModal(true);
    } else if (item.requiresAuth && isGuest) {
      setRegistrationModal(true, () => navigate(item.path!));
    } else if (item.path) {
      navigate(item.path);
    }
  }, [isAuthenticated, isGuest, navigate, setRegistrationModal, toggleSidebar]);

  return (
    <nav
      aria-label={t('nav.nav_sections', 'Главная навигация')}
      className="fixed bottom-0 left-0 right-0 z-50 overflow-x-hidden border-t border-bdr-subtle bg-surface-1"
      style={{
        paddingBottom: 'var(--dv-safe-bottom)',
        paddingLeft: 'var(--dv-safe-left)',
        paddingRight: 'var(--dv-safe-right)',
      }}
    >
      <div className="mx-auto flex h-[var(--dv-bottomnav-height,3.5rem)] w-full max-w-xl items-stretch justify-between px-1 sm:px-2">
        {ITEMS.map((item) => {
          const isActive = item.id === 'cabinet' && item.path
            ? (() => {
                const [targetPath, targetQuery = ''] = item.path!.split('?')
                const cabinetParams = new URLSearchParams(targetQuery)
                cabinetParams.delete('tab')
                cabinetParams.delete('section')
                const cabinetTarget = cabinetParams.size ? `${targetPath}?${cabinetParams.toString()}` : targetPath
                return isWorkspaceNavigationActive(location.pathname, location.search, cabinetTarget, { matchAllTabs: true })
              })()
            : Boolean(item.path) && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              whileTap={{ scale: 0.97 }}
              className="relative flex h-full min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className={cn('shrink-0 transition-colors', isActive ? '' : 'text-txt-muted')} style={isActive ? { color: item.color } : undefined}>
                {item.icon}
              </span>
              <span className={cn('max-w-full truncate px-0.5 text-[clamp(9px,2.6vw,10px)] font-medium leading-tight transition-colors', isActive ? '' : 'text-txt-muted')} style={isActive ? { color: item.color } : undefined}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
