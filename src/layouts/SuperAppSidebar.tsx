import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, BarChart3, BriefcaseBusiness, ChevronDown, ChevronRight, CircleHelp, Command, Database, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, MessageCircle, Settings, ShoppingBag, ShieldCheck, Sparkles, Stethoscope, UserRound, Users, X, Zap, CalendarDays, WalletCards, Package, Megaphone, ClipboardList, FileCheck2, Bot, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand';
import { Avatar } from '@/components/ui/ds/Avatar';
import type { User as UserType } from '@/types';
import { useCommandPalette } from '@/components/CommandPalette';

export interface SuperAppSidebarProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  sidebarVisible: boolean;
  isMobile: boolean;
  sidebarOpen: boolean;
  user: UserType | null;
  logout: () => void;
  toggleSidebar: () => void;
  isGuest?: boolean;
  pendingApprovals?: number;
  isAdmin?: boolean;
}

type Item = { id: string; labelKey: string; fallback: string; path: string; icon: React.ReactElement; badge?: string | number };
type Group = { id: string; labelKey: string; fallback: string; items: Item[] };

const groups: Group[] = [
  { id: 'workspace', labelKey: 'nav.digital_assistant', fallback: 'Рабочее пространство', items: [
    { id: 'ai', labelKey: 'nav.digital_assistant', fallback: 'Цифровой ассистент', path: '/ai', icon: <Sparkles /> },
    { id: 'diagnostics', labelKey: 'nav.diagnostics', fallback: 'Диагностика', path: '/diagnostics', icon: <Activity /> },
  ] },
  { id: 'clinic', labelKey: 'nav.section_patients', fallback: 'Клиника', items: [
    { id: 'patients', labelKey: 'nav.patients', fallback: 'Пациенты', path: '/crm/patients', icon: <Users /> },
    { id: 'schedule', labelKey: 'nav.schedule', fallback: 'Расписание', path: '/crm/schedule', icon: <CalendarDays /> },
    { id: 'dental-chart', labelKey: 'nav.dental_chart', fallback: 'Зубная карта', path: '/crm/dental-chart', icon: <Stethoscope /> },
    { id: 'treatment-plans', labelKey: 'nav.treatment_plans', fallback: 'Планы лечения', path: '/crm/treatment-plans', icon: <ClipboardList /> },
    { id: 'medical-card', labelKey: 'nav.medical_card', fallback: 'Медкарта', path: '/crm/medical-card', icon: <FileCheck2 /> },
    { id: 'visits', labelKey: 'nav.visits', fallback: 'Визиты', path: '/crm/visits', icon: <LayoutDashboard /> },
    { id: 'lab', labelKey: 'nav.lab', fallback: 'Лаборатория', path: '/crm/lab', icon: <Activity /> },
    { id: 'patient-inbox', labelKey: 'nav.patient_inbox', fallback: 'Диалоги с пациентами', path: '/crm/patient-inbox', icon: <MessagesSquare /> },
  ] },
  { id: 'operations', labelKey: 'nav.section_finance', fallback: 'Операции', items: [
    { id: 'finance', labelKey: 'nav.finance', fallback: 'Финансы и касса', path: '/crm/cashier', icon: <WalletCards /> },
    { id: 'inventory', labelKey: 'nav.inventory', fallback: 'Склад', path: '/crm/inventory', icon: <Package /> },
    { id: 'pricelist', labelKey: 'nav.pricelist', fallback: 'Прайс', path: '/crm/pricelist', icon: <FileText /> },
    { id: 'marketing', labelKey: 'nav.marketing', fallback: 'Маркетинг', path: '/crm/marketing', icon: <Megaphone /> },
    { id: 'promotions', labelKey: 'nav.promotions', fallback: 'Акции', path: '/crm/promotions', icon: <Zap /> },
    { id: 'reminders', labelKey: 'nav.reminders', fallback: 'Напоминания', path: '/crm/reminders', icon: <MessageCircle /> },
    { id: 'documents', labelKey: 'nav.documents', fallback: 'Документы', path: '/crm/documents', icon: <FileText /> },
    { id: 'staff', labelKey: 'nav.staff', fallback: 'Сотрудники', path: '/crm/staff', icon: <Users /> },
    { id: 'workflow', labelKey: 'nav.workflow', fallback: 'Автоматизация', path: '/crm/workflow', icon: <Bot /> },
  ] },
  { id: 'business', labelKey: 'nav.services', fallback: 'Сервисы', items: [
    { id: 'shop', labelKey: 'nav.market', fallback: 'Маркет', path: '/shop', icon: <ShoppingBag /> },
    { id: 'academy', labelKey: 'nav.school', fallback: 'Академия', path: '/school', icon: <GraduationCap /> },
    { id: 'analytics', labelKey: 'nav.analytics', fallback: 'Аналитика', path: '/analytics', icon: <BarChart3 /> },
  ] },
  { id: 'network', labelKey: 'nav.network', fallback: 'Сеть', items: [
    { id: 'jobs', labelKey: 'nav.jobs', fallback: 'Вакансии', path: '/jobs', icon: <BriefcaseBusiness /> },
    { id: 'community', labelKey: 'nav.community', fallback: 'Сообщество', path: '/community', icon: <Users /> },
  ] },
];

const moreItems: Item[] = [
  { id: 'profile', labelKey: 'nav.profile', fallback: 'Профиль', path: '/profile', icon: <UserRound /> },
  { id: 'settings', labelKey: 'nav.settings', fallback: 'Настройки', path: '/settings', icon: <Settings /> },
  { id: 'help', labelKey: 'nav.help', fallback: 'Помощь и поддержка', path: '/help', icon: <CircleHelp /> },
  { id: 'clinic-settings', labelKey: 'nav.clinic_settings', fallback: 'Настройки клиники', path: '/crm/clinic-settings', icon: <Settings /> },
  { id: 'billing', labelKey: 'nav.billing', fallback: 'Тариф и оплата', path: '/crm/billing', icon: <WalletCards /> },
  { id: 'integrations', labelKey: 'nav.integrations', fallback: 'Интеграции', path: '/crm/integrations/messaging', icon: <MessageCircle /> },
  { id: 'icd10', labelKey: 'nav.icd10', fallback: 'МКБ-10', path: '/crm/icd10', icon: <FileCheck2 /> },
];

const adminItems: Item[] = [
  { id: 'admin', labelKey: 'nav.admin', fallback: 'Администрирование', path: '/admin', icon: <ShieldCheck /> },
  { id: 'approvals', labelKey: 'nav.ai_approvals', fallback: 'Подтверждения ИИ', path: '/ai-approvals', icon: <Zap /> },
  { id: 'agents', labelKey: 'nav.agent_activity', fallback: 'Активность ИИ', path: '/agent-activity', icon: <Sparkles /> },
  { id: 'audit', labelKey: 'nav.audit', fallback: 'Аудит и безопасность', path: '/audit', icon: <Database /> },
  { id: 'bi', labelKey: 'nav.bi', fallback: 'Бизнес-аналитика', path: '/bi', icon: <BarChart3 /> },
  { id: 'backup', labelKey: 'nav.backup', fallback: 'Резервные копии', path: '/backup', icon: <Database /> },
];

function isActive(pathname: string, itemPath: string) {
  if (itemPath === '/ai') return pathname === '/ai' || pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function NavItem({ item, collapsed, active, onNavigate, label }: { item: Item; collapsed: boolean; active: boolean; onNavigate: (path: string) => void; label: string }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      onClick={() => onNavigate(item.path)}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left transition-all duration-200',
        collapsed ? 'justify-center px-2' : '',
        active ? 'bg-[var(--dv-nav-active)] text-[var(--dv-text)]' : 'text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]',
      )}
    >
      {active && <motion.span layoutId="dv-active-rail" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--dv-accent)]" />}
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[9px] transition-colors', active ? 'bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]' : 'bg-[var(--dv-icon-bg)] text-current')}>
        {React.cloneElement(item.icon, { size: 17, strokeWidth: 1.8 })}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>}
      {!collapsed && item.badge !== undefined && <span className="rounded-full bg-[var(--dv-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
    </button>
  );
}

export const SuperAppSidebar: React.FC<SuperAppSidebarProps> = (props) => {
  const { collapsed, setCollapsed, sidebarVisible, isMobile, sidebarOpen, user, logout, toggleSidebar, isGuest = false, pendingApprovals = 0, isAdmin = false } = props;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { open: openCommandPalette } = useCommandPalette();
  const text = React.useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  }, [t]);
  const go = React.useCallback((path: string) => {
    navigate(path);
    if (isMobile) toggleSidebar();
  }, [navigate, isMobile, toggleSidebar]);

  const width = collapsed ? 76 : 260;
  const visible = sidebarVisible || (isMobile && sidebarOpen);
  if (!visible) return null;

  return (
    <>
      {isMobile && sidebarOpen && (
        <button type="button" aria-label={text('common.close', 'Закрыть')} className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" onClick={() => toggleSidebar()} />
      )}
      <motion.aside initial={false} animate={{ width: isMobile ? 280 : width, x: isMobile && !sidebarOpen ? -300 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} className="fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-[var(--dv-border)] bg-[var(--dv-sidebar)]">
        <div className={cn('flex h-16 shrink-0 items-center border-b border-[var(--dv-border)] px-3', collapsed && !isMobile ? 'justify-center' : 'justify-between')}>
          <button type="button" onClick={() => go('/ai')} className="flex min-w-0 items-center gap-2.5"><Logo />{(!collapsed || isMobile) && <span className="text-[15px] font-semibold tracking-[-0.02em]">DentVision</span>}</button>
          {isMobile ? (
            <button type="button" onClick={() => toggleSidebar()} className="rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]" aria-label={text('common.close', 'Закрыть')}><X size={18} /></button>
          ) : (
            <button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]" aria-label={collapsed ? text('nav.expand_sidebar', 'Развернуть меню') : text('nav.collapse_sidebar', 'Свернуть меню')}>{collapsed ? <ChevronRight size={17} /> : <ChevronRight className="rotate-180" size={17} />}</button>
          )}
        </div>
        <div className="px-3 pt-3">
          <button type="button" onClick={() => openCommandPalette()} className={cn('flex w-full items-center gap-2.5 rounded-xl border border-[var(--dv-border)] bg-[var(--dv-surface)] px-2.5 py-2 text-left transition hover:border-[var(--dv-border-strong)]', collapsed && !isMobile && 'justify-center')} aria-label={text('common.search', 'Поиск')}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]"><Command size={14} /></span>
            {(!collapsed || isMobile) && <><span className="flex-1 text-xs font-medium text-[var(--dv-text)]">{text('common.search', 'Поиск')}</span><kbd className="rounded-md border border-[var(--dv-border)] px-1.5 py-0.5 text-[10px] text-[var(--dv-muted)]">⌘K</kbd></>}
          </button>
        </div>
        <nav aria-label={text('nav.main_nav', 'Главная навигация')} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none]">
          {groups.map((group) => (
            <section key={group.id} className="mb-5">
              {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">{text(group.labelKey, group.fallback)}</div>}
              {collapsed && !isMobile && <div className="mx-auto mb-1.5 h-px w-7 bg-[var(--dv-border)]" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.id} item={item} label={text(item.labelKey, item.fallback)} collapsed={collapsed && !isMobile} active={isActive(location.pathname, item.path)} onNavigate={go} />
                ))}
              </div>
            </section>
          ))}
          <section>
            {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">{text('nav.menu', 'Меню')}</div>}
            <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={cn('flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]', collapsed && !isMobile && 'justify-center')}>
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--dv-icon-bg)]"><Menu size={17} /></span>
              {(!collapsed || isMobile) && <><span className="flex-1">{text('nav.menu', 'Меню')}</span>{moreOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</>}
            </button>
            <AnimatePresence initial={false}>
              {moreOpen && (!collapsed || isMobile) && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-0.5 overflow-hidden pl-2">
                  {moreItems.map((item) => <NavItem key={item.id} item={item} label={text(item.labelKey, item.fallback)} collapsed={false} active={isActive(location.pathname, item.path)} onNavigate={go} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          {isAdmin && !isGuest && (
            <section className="mt-5 border-t border-[var(--dv-border)] pt-4">
              {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">{text('nav.administration', 'Администрирование')}</div>}
              {adminItems.map((item) => (
                <NavItem key={item.id} item={{ ...item, badge: item.id === 'approvals' && pendingApprovals ? pendingApprovals : undefined }} label={text(item.labelKey, item.fallback)} collapsed={collapsed && !isMobile} active={isActive(location.pathname, item.path)} onNavigate={go} />
              ))}
            </section>
          )}
        </nav>
        <div className="border-t border-[var(--dv-border)] p-3">
          <button type="button" onClick={() => go('/profile')} className={cn('flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-[var(--dv-nav-hover)]', collapsed && !isMobile && 'justify-center')}>
            <Avatar src={user?.avatar} name={user?.name || text('nav.guest', 'Пользователь')} size="sm" />
            {(!collapsed || isMobile) && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--dv-text)]">{user?.name || (isGuest ? text('nav.guest', 'Гость') : 'DentVision')}</span><span className="block truncate text-[11px] text-[var(--dv-muted)]">{isGuest ? text('nav.anonymous_access', 'Демо-режим') : text('nav.employee', 'Рабочее пространство')}</span></span>}
          </button>
          {!isGuest && (!collapsed || isMobile) && <button type="button" onClick={() => logout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-danger)]"><LogOut size={14} />{text('auth.logout', 'Выйти')}</button>}
        </div>
      </motion.aside>
    </>
  );
};

export default SuperAppSidebar;
