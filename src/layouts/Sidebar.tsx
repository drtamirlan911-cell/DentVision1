import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope, ChevronLeft, ChevronRight, LogOut, Brain,
  ShoppingCart, GraduationCap, Briefcase, BarChart3, Users, User,
  Shield, FileText, Database, Settings, FlaskConical, Star, LogIn, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/ds/Avatar';
import { Badge } from '@/components/ui/ds/Badge';
import { Tooltip } from '@/components/ui/ds/Tooltip';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { useAuth, canManageClinicSettings } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';
import { canAccessPage } from '@/lib/roleAccess';
import type { User as UserType, RoleInfo } from '@/types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string | number;
  color?: string;
  section?: 'services' | 'platform';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={16} />, path: '/crm/schedule', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={16} />, path: '/shop', color: '#8E44AD', section: 'services' },
  { id: 'school', label: 'Academy OS', icon: <GraduationCap size={16} />, path: '/school', color: '#16A085', section: 'services' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={16} />, path: '/analytics', color: '#F39C12', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={16} />, path: '/jobs', color: '#E67E22', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={16} />, path: '/community', color: '#00BCD4', section: 'services' },
  { id: 'supplier', label: 'Кабинет продавца', icon: <Store size={16} />, path: '/supplier', color: '#16A085', section: 'platform' },
  { id: 'school-workspace', label: 'Кабинет лектора', icon: <GraduationCap size={16} />, path: '/school-workspace', color: '#16A085', section: 'platform' },
  { id: 'profile', label: 'Профиль', icon: <User size={16} />, path: '/profile', color: '#2980B9', section: 'platform' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={16} />, path: '/settings', color: '#64748B', section: 'platform' },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: 'admin', label: 'Платформа', icon: <Shield size={16} />, path: '/admin', color: '#E74C3C', section: 'platform' },
  { id: 'audit', label: 'Аудит', icon: <FileText size={16} />, path: '/audit', color: '#F39C12', section: 'platform' },
  { id: 'backup', label: 'Бэкапы', icon: <Database size={16} />, path: '/backup', color: '#00BCD4', section: 'platform' },
];

const GUEST_NAV_ITEMS: NavItem[] = [
  { id: 'demo', label: 'Демо клиника', icon: <FlaskConical size={16} />, path: '/crm/schedule?demo=1', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={16} />, path: '/shop', color: '#8E44AD', section: 'services' },
  { id: 'school', label: 'Academy OS', icon: <GraduationCap size={16} />, path: '/school', color: '#16A085', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={16} />, path: '/jobs', color: '#E67E22', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={16} />, path: '/community', color: '#00BCD4', section: 'services' },
  { id: 'pricing', label: 'Тарифы', icon: <Star size={16} />, path: '/pricing', color: '#F39C12', section: 'platform' },
];

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

const CRM_SUBNAV = [
  { id: 'schedule', label: 'Расписание', path: '/crm/schedule' },
  { id: 'patients', label: 'Пациенты', path: '/crm/patients' },
  { id: 'medical-card', label: 'Медкарта', path: '/crm/medical-card' },
  { id: 'finance', label: 'Финансы', path: '/crm/finance' },
  { id: 'clinic-settings', label: 'Настройки клиники', path: '/crm/clinic-settings', adminOnly: true },
  { id: 'billing', label: 'Тариф и оплата', path: '/crm/billing', adminOnly: true },
  { id: 'visits', label: 'Визиты', path: '/crm/visits' },
  { id: 'dental-chart', label: 'Зубная карта', path: '/crm/dental-chart' },
  { id: 'treatment-plans', label: 'Планы лечения', path: '/crm/treatment-plans' },
  { id: 'pricelist', label: 'Прайс', path: '/crm/pricelist' },
  { id: 'lab', label: 'Лаборатория', path: '/crm/lab' },
  { id: 'inventory', label: 'Склад', path: '/crm/inventory' },
  { id: 'documents', label: 'Документы', path: '/crm/documents' },
  { id: 'staff', label: 'Сотрудники', path: '/crm/staff' },
  { id: 'reminders', label: 'Напоминания', path: '/crm/reminders' },
  { id: 'promotions', label: 'Акции', path: '/crm/promotions' },
  { id: 'icd10', label: 'МКБ-10', path: '/crm/icd10' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed, setCollapsed, sidebarVisible, isMobile, sidebarOpen,
  user, roleInfo, logout, toggleSidebar, isGuest = false, onToggleCollapsed,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [crmOpen, setCrmOpen] = React.useState(location.pathname.startsWith('/crm'));
  const sidebarWidth = !sidebarVisible && !isMobile ? 0 : (collapsed ? 72 : 240);
  const { user: authUser, role: authRole, roleInfo: authRoleInfo, activeMembership } = useAuth();
  const clinicId = authUser?.clinicId || '';

  React.useEffect(() => {
    if (location.pathname.startsWith('/crm')) setCrmOpen(true);
  }, [location.pathname]);

  // Always prefer live useAuth roleInfo — prop roleInfo can lag behind membership.
  const allowedPages = authRoleInfo?.pages?.length
    ? authRoleInfo.pages
    : ((roleInfo as any)?.pages || []);
  const isAdmin = allowedPages.includes('admin');
  const showClinicSettings =
    allowedPages.includes('clinic-settings') ||
    !!(authRoleInfo as any)?.canManageClinicSettings ||
    !!(roleInfo as any)?.canManageClinicSettings ||
    canManageClinicSettings(authRole) ||
    canManageClinicSettings(activeMembership?.role) ||
    canManageClinicSettings(authUser?.role);

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

  const serviceItems = isGuest ? GUEST_NAV_ITEMS : NAV_ITEMS.filter(item => {
    if (item.id === 'crm') return true;
    if (item.id === 'profile' || item.id === 'settings') return true;
    if (item.id === 'supplier' || item.id === 'school-workspace') return true;
    if (item.id === 'jobs' || item.id === 'community') return true;
    if (item.id === 'shop') return allowedPages.length === 0 || canAccessPage(allowedPages, 'shop');
    if (item.id === 'school') return allowedPages.length === 0 || canAccessPage(allowedPages, 'school');
    if (item.id === 'analytics') return canAccessPage(allowedPages, 'analytics');
    return canAccessPage(allowedPages, item.id) || allowedPages.length === 0;
  });

  const visibleCrmSubnav = CRM_SUBNAV.filter((sub) => {
    if ((sub as { adminOnly?: boolean }).adminOnly) {
      return showClinicSettings || canAccessPage(allowedPages, sub.id);
    }
    // Guests / empty ACL: hide tools until role pages resolve
    if (!allowedPages.length) return false;
    return canAccessPage(allowedPages, sub.id);
  });

  const handleNavClick = (path: string) => {
    if (isGuest) {
      // Guests may enter /crm — IntelligenceLayout shows GuestCRMModal (demo/create/join).
      const publicPaths = ['/shop', '/school', '/jobs', '/community', '/demo', '/pricing', '/', '/crm'];
      if (publicPaths.some(p => path === p || path.startsWith(p + '/'))) {
        navigate(path);
      } else {
        useGuestStore.getState().setRegistrationModal(true, () => navigate(path));
      }
    } else {
      navigate(path);
    }
    if (isMobile && sidebarOpen) toggleSidebar();
  };

  const renderNavSection = (items: NavItem[], sectionLabel?: string) => (
    <>
      {!collapsed && sectionLabel && (
        <div className="pt-3 pb-1">
          <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">{sectionLabel}</p>
        </div>
      )}
      {items.map(item => {
        const isCrm = item.id === 'crm';
        const isActive = isCrm
          ? location.pathname.startsWith('/crm')
          : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        const btn = (
          <motion.button
            onClick={() => {
              if (isCrm && !collapsed) {
                setCrmOpen((v) => !v);
                if (!location.pathname.startsWith('/crm')) handleNavClick(item.path);
              } else {
                handleNavClick(item.path);
              }
            }}
            onMouseEnter={() => prefetchFor(item.id)}
            whileHover={collapsed ? undefined : { scale: 1.02 }}
            whileTap={collapsed ? undefined : { scale: 0.97 }}
            className={cn(
              'relative flex w-full items-center rounded-lg transition-colors duration-150',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2',
              isActive
                ? 'bg-white/[0.06] text-txt-primary'
                : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
            )}
          >
            {isActive && (
              <span
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-dv-gold shadow-sm shadow-dv-gold/50',
                  collapsed ? 'left-0.5' : 'left-1',
                )}
              />
            )}
            <span className={cn('shrink-0 transition-colors', isActive ? 'text-dv-gold' : 'text-txt-muted')}>
              {item.icon}
            </span>
            {!collapsed && (
              <>
                <span className="text-sm truncate flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <Badge variant="gold" size="xs">{item.badge}</Badge>
                )}
                {isCrm && (
                  <ChevronRight size={12} className={cn('text-txt-ghost transition-transform', crmOpen && 'rotate-90')} />
                )}
              </>
            )}
          </motion.button>
        );
        return (
          <Tooltip key={item.id} content={collapsed ? item.label : undefined} side="right">
            <div>
              {btn}
              {isCrm && !collapsed && crmOpen && !isGuest && (
                <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-white/[0.06] pl-2">
                  {visibleCrmSubnav.map((sub) => {
                    const subActive = location.pathname === sub.path || location.pathname.startsWith(sub.path + '/');
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleNavClick(sub.path)}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors',
                          subActive
                            ? 'text-dv-gold bg-dv-gold/10'
                            : 'text-txt-muted hover:text-txt-primary hover:bg-white/[0.04]'
                        )}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                  {visibleCrmSubnav.length === 0 && (
                    <p className="px-2.5 py-1.5 text-[10px] text-txt-ghost">Нет доступных разделов</p>
                  )}
                </div>
              )}
            </div>
          </Tooltip>
        );
      })}
    </>
  );

  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarWidth,
        x: isMobile ? (sidebarOpen ? 0 : -Math.max(sidebarWidth, 72)) : 0,
        opacity: sidebarVisible ? 1 : 0,
      }}
      transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'h-full flex flex-col bg-surface-1/80 backdrop-blur-xl border-r border-white/[0.04] flex-shrink-0 z-50 relative overflow-hidden origin-left',
        isMobile && 'fixed top-0 left-0 bottom-0 dv-safe-sidebar',
        !sidebarVisible && !isMobile && 'pointer-events-none border-transparent',
      )}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth,
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.8) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Header: expanded = logo+title+toggle; collapsed = centered logo + corner expand */}
      <div
        className={cn(
          'relative flex h-14 border-b border-bdr-subtle flex-shrink-0',
          collapsed ? 'items-center justify-center px-1' : 'items-center justify-between px-3',
        )}
      >
        <div className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/15">
            <Stethoscope size={16} className="text-dv-gold" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-dv-gold tracking-tight truncate">DentVision</h1>
              <p className="text-2xs text-txt-muted truncate max-w-[140px]">Intelligence</p>
            </div>
          )}
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
            aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-bdr-subtle flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar name={isGuest ? 'Гость' : (user?.name || user?.login || '?')} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-txt-primary truncate">{isGuest ? 'Гость' : (user?.name || user?.login)}</p>
              <p className="text-2xs text-txt-muted">{isGuest ? 'Анонимный доступ' : ((roleInfo as any)?.label || 'Сотрудник')}</p>
            </div>
          </div>
        </div>
      )}

      <div className={cn('pt-2 flex-shrink-0', collapsed ? 'px-1.5' : 'px-2')}>
        <motion.button
          type="button"
          onClick={() => handleNavClick('/')}
          whileTap={collapsed ? undefined : { scale: 0.98 }}
          className={cn(
            'flex w-full items-center rounded-xl transition-colors duration-200 border',
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2.5',
            location.pathname === '/'
              ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
              : 'border-dv-gold/10 text-txt-secondary hover:border-dv-gold/30 hover:text-dv-gold bg-dv-gold/[0.04]',
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

      {!collapsed && isGuest && (
        <div className="px-3 pt-2 pb-1 flex-shrink-0">
          <div className="rounded-xl border border-dv-gold/20 bg-gradient-to-br from-dv-gold/10 via-dv-gold/5 to-transparent p-3 space-y-2">
            <p className="text-xs font-semibold text-txt-primary">Знакомство с DentVision</p>
            <p className="text-[11px] text-txt-muted leading-relaxed">
              CRM, маркетплейс и Academy в одной SuperApp. Откройте демо или спросите ИИ.
            </p>
            <button
              type="button"
              onClick={() => handleNavClick('/crm/schedule?demo=1')}
              className="w-full rounded-lg bg-dv-gold px-3 py-1.5 text-xs font-semibold text-surface-0 hover:bg-dv-gold/90 transition-colors"
            >
              Открыть демо
            </button>
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="px-3 pt-4 pb-1 flex-shrink-0">
          <p className="text-2xs font-semibold text-txt-ghost uppercase tracking-wider">
            {isGuest ? 'Открыть' : 'Сервисы'}
          </p>
        </div>
      )}

      <motion.nav
        initial="hidden"
        animate={sidebarVisible ? 'visible' : 'hidden'}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } },
        }}
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden py-1 space-y-0.5 no-scrollbar',
          collapsed ? 'px-1.5' : 'px-2',
        )}
      >
        {isGuest
          ? renderNavSection(GUEST_NAV_ITEMS)
          : <>
            {renderNavSection(serviceItems.filter(i => i.section !== 'platform'))}
            {renderNavSection(serviceItems.filter(i => i.section === 'platform'), 'Платформа')}
            {isAdmin && renderNavSection(ADMIN_ITEMS, 'Администрирование')}
          </>
        }
      </motion.nav>

      <div className={cn('pb-2 flex-shrink-0 space-y-1', collapsed ? 'px-1.5' : 'px-2')}>
        {!isGuest && user ? (
          <motion.button
            type="button"
            onClick={() => { logout(); navigate('/login'); }}
            whileTap={collapsed ? undefined : { scale: 0.98 }}
            className={cn(
              'flex w-full items-center rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2',
            )}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={() => navigate('/login')}
            whileTap={collapsed ? undefined : { scale: 0.98 }}
            className={cn(
              'flex w-full items-center rounded-lg border border-dv-gold/20 text-dv-gold transition-colors hover:bg-dv-gold/10',
              collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2',
            )}
          >
            <LogIn size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Войти</span>}
          </motion.button>
        )}
      </div>
    </motion.aside>
  );
};
