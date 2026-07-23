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
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={18} strokeWidth={1.75} />, path: '/crm/schedule', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={18} strokeWidth={1.75} />, path: '/shop', color: '#A78BFA', section: 'services' },
  { id: 'school', label: 'Academy OS', icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school', color: '#2DD4BF', section: 'services' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} strokeWidth={1.75} />, path: '/analytics', color: '#FBBF24', section: 'services' },
  { id: 'bi', label: 'Business Intelligence', icon: <BarChart3 size={18} strokeWidth={1.75} />, path: '/bi', color: '#10B981', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={18} strokeWidth={1.75} />, path: '/jobs', color: '#FB923C', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={18} strokeWidth={1.75} />, path: '/community', color: '#38BDF8', section: 'services' },
  { id: 'supplier', label: 'Кабинет продавца', icon: <Store size={18} strokeWidth={1.75} />, path: '/supplier', color: '#34D399', section: 'platform' },
  { id: 'school-workspace', label: 'Кабинет лектора', icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school-workspace', color: '#2DD4BF', section: 'platform' },
  { id: 'profile', label: 'Профиль', icon: <User size={18} strokeWidth={1.75} />, path: '/profile', color: '#60A5FA', section: 'platform' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={18} strokeWidth={1.75} />, path: '/settings', color: '#94A3B8', section: 'platform' },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: 'admin', label: 'Платформа', icon: <Shield size={18} strokeWidth={1.75} />, path: '/admin', color: '#F87171', section: 'platform' },
  { id: 'audit', label: 'Аудит', icon: <FileText size={18} strokeWidth={1.75} />, path: '/audit', color: '#FBBF24', section: 'platform' },
  { id: 'security', label: 'Security & Compliance', icon: <ShieldCheck size={18} strokeWidth={1.75} />, path: '/security', color: '#38BDF8', section: 'platform' },
  { id: 'backup', label: 'Бэкапы', icon: <Database size={18} strokeWidth={1.75} />, path: '/backup', color: '#38BDF8', section: 'platform' },
];

const GUEST_NAV_ITEMS: NavItem[] = [
  { id: 'demo', label: 'Демо клиника', icon: <FlaskConical size={18} strokeWidth={1.75} />, path: '/crm/schedule?demo=1', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={18} strokeWidth={1.75} />, path: '/shop', color: '#A78BFA', section: 'services' },
  { id: 'school', label: 'Academy OS', icon: <GraduationCap size={18} strokeWidth={1.75} />, path: '/school', color: '#2DD4BF', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={18} strokeWidth={1.75} />, path: '/jobs', color: '#FB923C', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={18} strokeWidth={1.75} />, path: '/community', color: '#38BDF8', section: 'services' },
  { id: 'pricing', label: 'Тарифы', icon: <Star size={18} strokeWidth={1.75} />, path: '/pricing', color: '#FBBF24', section: 'platform' },
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
  const clinicId = authUser?.clinicId || '';

  React.useEffect(() => {
    if (location.pathname.startsWith('/crm')) setCrmOpen(true);
  }, [location.pathname]);

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
    if (item.id === 'bi') {
      const r = String(authRole || '').toLowerCase();
      return r === 'owner' || r === 'director' || r === 'superadmin';
    }
    return canAccessPage(allowedPages, item.id) || allowedPages.length === 0;
  });

  const visibleCrmSubnav = CRM_SUBNAV.filter((sub) => {
    if ((sub as { adminOnly?: boolean }).adminOnly) {
      return showClinicSettings || canAccessPage(allowedPages, sub.id);
    }
    if (!allowedPages.length) return false;
    return canAccessPage(allowedPages, sub.id);
  });

  const handleNavClick = (path: string) => {
    if (isGuest) {
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
            onClick={() => {
              if (isCrm && !collapsed) {
                setCrmOpen((v) => !v);
                if (!location.pathname.startsWith('/crm')) handleNavClick(item.path);
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
                <div className="ml-4 mt-1 mb-1.5 space-y-0.5 border-l border-white/[0.07] pl-2.5">
                  {visibleCrmSubnav.map((sub) => {
                    const subActive = location.pathname === sub.path || location.pathname.startsWith(sub.path + '/');
                    return (
                      <button
                        key={sub.id}
                        type="button"
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
        'bg-gradient-to-b from-[#0E1A2C] via-[#0B1524] to-[#09101C]',
        'border-r border-white/[0.05]',
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
          className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.45) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-24 -left-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%)' }}
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
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(145deg, rgba(201,169,110,0.28), rgba(201,169,110,0.08))',
              boxShadow: 'inset 0 0 0 1px rgba(201,169,110,0.35), 0 4px 16px rgba(201,169,110,0.12)',
            }}
          >
            <Stethoscope size={17} className="text-dv-gold" strokeWidth={1.75} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-[13px] font-bold text-dv-gold tracking-tight truncate leading-tight">DentVision</h1>
              <p className="text-[10px] text-txt-muted truncate leading-tight mt-0.5">SuperApp</p>
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
        <div className="relative px-3.5 py-3 border-b border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={isGuest ? 'Гость' : (user?.name || user?.login || '?')}
              size="sm"
              src={isGuest ? undefined : ((user as any)?.photoUrl || (user as any)?.avatar || undefined)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-txt-primary truncate">{isGuest ? 'Гость' : (user?.name || user?.login)}</p>
              <p className="text-[10px] text-txt-muted truncate">{isGuest ? 'Анонимный доступ' : ((roleInfo as any)?.label || 'Сотрудник')}</p>
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
                  : 'linear-gradient(145deg, rgba(201,169,110,0.18), rgba(201,169,110,0.06))',
                boxShadow: intelligenceActive
                  ? 'inset 0 0 0 1px rgba(201,169,110,0.5), 0 0 22px rgba(201,169,110,0.22)'
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
                <p className="text-[10px] text-txt-muted truncate">Цифровой ассистент</p>
              </div>
            )}
          </motion.button>
        </Tooltip>
      </div>

      {!collapsed && isGuest && (
        <div className="px-3 pt-3 pb-1 flex-shrink-0">
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
        <div className="px-3.5 pt-4 pb-1 flex-shrink-0">
          <p className="text-[10px] font-semibold text-txt-ghost uppercase tracking-[0.14em]">
            {isGuest ? 'Открыть' : 'Сервисы'}
          </p>
        </div>
      )}

      {collapsed && (
        <div className="my-2.5 mx-auto h-px w-8 rounded-full bg-gradient-to-r from-transparent via-dv-gold/35 to-transparent flex-shrink-0" />
      )}

      <motion.nav
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
            {renderNavSection(serviceItems.filter(i => i.section === 'platform'), 'Платформа')}
            {isAdmin && renderNavSection(ADMIN_ITEMS, 'Администрирование')}
          </>
        }
      </motion.nav>

      {/* Footer actions — pinned bottom of the vertical stack */}
      <div className={cn('relative pb-3 pt-2 flex-shrink-0 space-y-1.5', collapsed ? 'px-2' : 'px-2.5')}>
        <div className="mx-auto mb-1.5 h-px w-full max-w-[9rem] rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {!isGuest && user ? (
          <Tooltip content={collapsed ? 'Выйти' : undefined} side="right">
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
              {!collapsed && <span className="text-sm font-medium">Выйти</span>}
            </motion.button>
          </Tooltip>
        ) : (
          <Tooltip content={collapsed ? 'Войти' : undefined} side="right">
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
              {!collapsed && <span className="text-sm font-medium">Войти</span>}
            </motion.button>
          </Tooltip>
        )}
      </div>
    </motion.aside>
  );
};
