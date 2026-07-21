import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope, ChevronLeft, ChevronRight, LogOut, Brain,
  ShoppingCart, GraduationCap, Briefcase, BarChart3, Users, User,
  Shield, FileText, Database, Settings, Bot, FlaskConical, Star, LogIn, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/ds/Avatar';
import { Badge } from '@/components/ui/ds/Badge';
import { Tooltip } from '@/components/ui/ds/Tooltip';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { useAuth, canManageClinicSettings } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';
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
  { id: 'school', label: 'Академия', icon: <GraduationCap size={16} />, path: '/school', color: '#16A085', section: 'services' },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={16} />, path: '/analytics', color: '#F39C12', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={16} />, path: '/jobs', color: '#E67E22', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={16} />, path: '/community', color: '#00BCD4', section: 'services' },
  { id: 'ai', label: 'AI Команда', icon: <Bot size={16} />, path: '/ai', color: '#8E44AD', section: 'platform' },
  { id: 'supplier', label: 'Кабинет продавца', icon: <Store size={16} />, path: '/supplier', color: '#16A085', section: 'platform' },
  { id: 'school-workspace', label: 'Кабинет школы', icon: <GraduationCap size={16} />, path: '/school-workspace', color: '#16A085', section: 'platform' },
  { id: 'profile', label: 'Профиль', icon: <User size={16} />, path: '/profile', color: '#2980B9', section: 'platform' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={16} />, path: '/settings', color: '#64748B', section: 'platform' },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: 'admin', label: 'Платформа', icon: <Shield size={16} />, path: '/admin', color: '#E74C3C', section: 'platform' },
  { id: 'audit', label: 'Аудит', icon: <FileText size={16} />, path: '/audit', color: '#F39C12', section: 'platform' },
  { id: 'backup', label: 'Бэкапы', icon: <Database size={16} />, path: '/backup', color: '#00BCD4', section: 'platform' },
];

const GUEST_NAV_ITEMS: NavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={16} />, path: '/crm/schedule', color: '#C9A96E', section: 'services' },
  { id: 'shop', label: 'Маркетплейс', icon: <ShoppingCart size={16} />, path: '/shop', color: '#8E44AD', section: 'services' },
  { id: 'school', label: 'Академия', icon: <GraduationCap size={16} />, path: '/school', color: '#16A085', section: 'services' },
  { id: 'jobs', label: 'Вакансии', icon: <Briefcase size={16} />, path: '/jobs', color: '#E67E22', section: 'services' },
  { id: 'community', label: 'Сообщество', icon: <Users size={16} />, path: '/community', color: '#00BCD4', section: 'services' },
  { id: 'demo', label: 'Демо клиника', icon: <FlaskConical size={16} />, path: '/demo', color: '#C9A96E', section: 'platform' },
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
  { id: 'visits', label: 'Визиты', path: '/crm/visits' },
  { id: 'dental-chart', label: 'Зубная карта', path: '/crm/dental-chart' },
  { id: 'treatment-plans', label: 'Планы лечения', path: '/crm/treatment-plans' },
  { id: 'pricelist', label: 'Прайс', path: '/crm/pricelist' },
  { id: 'lab', label: 'Лаборатория', path: '/crm/lab' },
  { id: 'inventory', label: 'Склад', path: '/crm/inventory' },
  { id: 'documents', label: 'Документы', path: '/crm/documents' },
  { id: 'staff', label: 'Сотрудники', path: '/crm/staff' },
  { id: 'reminders', label: 'Напоминания', path: '/crm/reminders' },
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
  }, [queryClient, clinicId]);

  const serviceItems = isGuest ? GUEST_NAV_ITEMS : NAV_ITEMS.filter(item => {
    if (item.section === 'platform' && item.id === 'ai') return true;
    if (item.section === 'platform') return true;
    // CRM is the workspace entry point. Keep it visible for every signed-in
    // user; access to individual tools remains governed by their role.
    if (item.id === 'crm') return true;
    if (item.id === 'shop') return allowedPages.length === 0 || allowedPages.includes('shop');
    if (item.id === 'school') return allowedPages.length === 0 || allowedPages.includes('school');
    return true;
  });

  const handleNavClick = (path: string) => {
    if (isGuest) {
      const publicPaths = ['/shop', '/school', '/jobs', '/community', '/demo', '/pricing', '/'];
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
              isActive
                ? 'bg-white/[0.06] text-txt-primary'
                : 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-dv-gold shadow-sm shadow-dv-gold/50"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
                  {CRM_SUBNAV.filter((sub) => !(sub as { adminOnly?: boolean }).adminOnly || showClinicSettings).map((sub) => {
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
        x: isMobile ? (sidebarOpen ? 0 : -sidebarWidth) : 0,
        opacity: sidebarVisible ? 1 : 0,
        scale: sidebarVisible ? 1 : 0.95,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={cn(
        'h-full flex flex-col bg-surface-1/80 backdrop-blur-xl border-r border-white/[0.04] flex-shrink-0 z-50 relative overflow-hidden',
        isMobile && 'fixed top-0 left-0 bottom-0',
        !sidebarVisible && !isMobile && 'pointer-events-none border-transparent'
      )}
      style={{ width: sidebarWidth }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -inset-[100%] opacity-[0.04] sidebar-gradient"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.8) 0%, transparent 60%)',
          }}
        />
      </div>
      <div className="flex items-center justify-between px-3 h-14 border-b border-bdr-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
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
        <button
          onClick={() => (onToggleCollapsed ? onToggleCollapsed() : setCollapsed(!collapsed))}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
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

      <div className="px-2 pt-2 flex-shrink-0">
        <motion.button
          onClick={() => handleNavClick('/')}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl transition-all duration-200 border',
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            location.pathname === '/'
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
        {isGuest
          ? renderNavSection(GUEST_NAV_ITEMS)
          : <>
            {renderNavSection(serviceItems.filter(i => i.section !== 'platform'))}
            {renderNavSection(serviceItems.filter(i => i.section === 'platform'), 'Платформа')}
            {isAdmin && renderNavSection(ADMIN_ITEMS, 'Администрирование')}
          </>
        }
      </motion.nav>

      <div className="px-2 pb-2 flex-shrink-0 space-y-1">
        {!isGuest && user ? (
          <motion.button
            onClick={() => { logout(); navigate('/login'); }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-error/15 text-error transition-colors hover:bg-error/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            <LogOut size={16} />
            {!collapsed && <span className="text-sm font-medium">Выйти</span>}
          </motion.button>
        ) : (
          <motion.button
            onClick={() => navigate('/login')}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg border border-dv-gold/20 text-dv-gold transition-colors hover:bg-dv-gold/10',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            <LogIn size={16} />
            {!collapsed && <span className="text-sm font-medium">Войти</span>}
          </motion.button>
        )}
      </div>
    </motion.aside>
  );
};
