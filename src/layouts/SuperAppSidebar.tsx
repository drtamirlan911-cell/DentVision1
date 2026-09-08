import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, BarChart3, Bell, BriefcaseBusiness, ChevronDown, ChevronRight,
  CircleHelp, Command, Database, GraduationCap, LayoutDashboard, LogOut,
  Menu, MessageCircle, Search, Settings, ShoppingBag, ShieldCheck, Sparkles,
  Stethoscope, UserRound, Users, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand';
import { Avatar } from '@/components/ui/ds/Avatar';
import type { User as UserType } from '@/types';

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

type Item = { id: string; label: string; path: string; icon: React.ReactNode; badge?: string | number };
type Group = { id: string; label: string; items: Item[] };

const groups: Group[] = [
  {
    id: 'core', label: 'WORKSPACE', items: [
      { id: 'ai', label: 'AI Workspace', path: '/', icon: <Sparkles /> },
      { id: 'practice', label: 'Practice', path: '/crm/schedule', icon: <Stethoscope /> },
      { id: 'diagnostics', label: 'Diagnostics', path: '/diagnostics', icon: <Activity /> },
    ],
  },
  {
    id: 'business', label: 'BUSINESS', items: [
      { id: 'shop', label: 'Shop', path: '/shop', icon: <ShoppingBag /> },
      { id: 'academy', label: 'Academy', path: '/school', icon: <GraduationCap /> },
      { id: 'analytics', label: 'Analytics', path: '/analytics', icon: <BarChart3 /> },
    ],
  },
  {
    id: 'network', label: 'NETWORK', items: [
      { id: 'jobs', label: 'Jobs', path: '/jobs', icon: <BriefcaseBusiness /> },
      { id: 'community', label: 'Community', path: '/community', icon: <Users /> },
    ],
  },
];

const moreItems: Item[] = [
  { id: 'profile', label: 'Profile', path: '/profile', icon: <UserRound /> },
  { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings /> },
  { id: 'help', label: 'Help & Support', path: '/help', icon: <CircleHelp /> },
];

const adminItems: Item[] = [
  { id: 'admin', label: 'Administration', path: '/admin', icon: <ShieldCheck /> },
  { id: 'approvals', label: 'AI Approvals', path: '/ai-approvals', icon: <Zap /> },
  { id: 'agents', label: 'AI Agents', path: '/agent-activity', icon: <Sparkles /> },
  { id: 'audit', label: 'Audit & Security', path: '/audit', icon: <Database /> },
];

function isActive(pathname: string, itemPath: string) {
  if (itemPath === '/') return pathname === '/';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function NavItem({ item, collapsed, active, onNavigate }: { item: Item; collapsed: boolean; active: boolean; onNavigate: (path: string) => void }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.path)}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left transition-all duration-200',
        collapsed ? 'justify-center px-2' : '',
        active ? 'bg-[var(--dv-nav-active)] text-[var(--dv-text)]' : 'text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]',
      )}
    >
      {active && <motion.span layoutId="dv-active-rail" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--dv-accent)]" />}
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[9px] transition-colors', active ? 'bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]' : 'bg-[var(--dv-icon-bg)] text-current')}>
        {React.cloneElement(item.icon as React.ReactElement, { size: 17, strokeWidth: 1.8 })}
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>}
      {!collapsed && item.badge !== undefined && <span className="rounded-full bg-[var(--dv-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
    </button>
  );
}

export const SuperAppSidebar: React.FC<SuperAppSidebarProps> = ({
  collapsed, setCollapsed, sidebarVisible, isMobile, sidebarOpen, user, logout, toggleSidebar,
  isGuest = false, pendingApprovals = 0, isAdmin = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const go = (path: string) => {
    navigate(path);
    if (isMobile) toggleSidebar();
  };

  const width = collapsed ? 76 : 260;
  const visible = sidebarVisible || (isMobile && sidebarOpen);

  if (!visible) return null;

  return (
    <>
      {isMobile && sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" onClick={toggleSidebar} />}
      <motion.aside
        initial={false}
        animate={{ width: isMobile ? 280 : width, x: isMobile && !sidebarOpen ? -300 : 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-[var(--dv-border)] bg-[var(--dv-sidebar)]"
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-[var(--dv-border)] px-3', collapsed && !isMobile ? 'justify-center' : 'justify-between')}>
          <button type="button" onClick={() => go('/')} className="flex min-w-0 items-center gap-2.5">
            <Logo />
            {(!collapsed || isMobile) && <span className="text-[15px] font-semibold tracking-[-0.02em]">DentVision</span>}
          </button>
          {isMobile ? (
            <button type="button" onClick={toggleSidebar} className="rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]"><X size={18} /></button>
          ) : (
            <button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
              {collapsed ? <ChevronRight size={17} /> : <ChevronRight className="rotate-180" size={17} />}
            </button>
          )}
        </div>

        <div className="px-3 pt-3">
          <button type="button" onClick={() => go('/')} className={cn('flex w-full items-center gap-2.5 rounded-xl border border-[var(--dv-border)] bg-[var(--dv-surface)] px-2.5 py-2 text-left transition hover:border-[var(--dv-border-strong)]', collapsed && !isMobile && 'justify-center')}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]"><Command size={14} /></span>
            {(!collapsed || isMobile) && <><span className="flex-1 text-xs font-medium text-[var(--dv-text)]">Search anything</span><kbd className="rounded-md border border-[var(--dv-border)] px-1.5 py-0.5 text-[10px] text-[var(--dv-muted)]">⌘K</kbd></>}
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none]">
          {groups.map((group) => (
            <section key={group.id} className="mb-5">
              {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">{group.label}</div>}
              {collapsed && !isMobile && <div className="mx-auto mb-1.5 h-px w-7 bg-[var(--dv-border)]" />}
              <div className="space-y-0.5">
                {group.items.map((item) => <NavItem key={item.id} item={item} collapsed={collapsed && !isMobile} active={isActive(location.pathname, item.path)} onNavigate={go} />)}
              </div>
            </section>
          ))}

          <section>
            {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">MORE</div>}
            <button type="button" onClick={() => setMoreOpen(!moreOpen)} className={cn('flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]', collapsed && !isMobile && 'justify-center')}>
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--dv-icon-bg)]"><Menu size={17} /></span>
              {(!collapsed || isMobile) && <><span className="flex-1">More</span>{moreOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</>}
            </button>
            <AnimatePresence initial={false}>
              {moreOpen && (!collapsed || isMobile) && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-0.5 overflow-hidden pl-2">
                {moreItems.map((item) => <NavItem key={item.id} item={item} collapsed={false} active={isActive(location.pathname, item.path)} onNavigate={go} />)}
              </motion.div>}
            </AnimatePresence>
          </section>

          {isAdmin && !isGuest && <section className="mt-5 border-t border-[var(--dv-border)] pt-4">
            {(!collapsed || isMobile) && <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--dv-muted-2)]">ADMINISTRATION</div>}
            {adminItems.map((item) => <NavItem key={item.id} item={{ ...item, badge: item.id === 'approvals' && pendingApprovals ? pendingApprovals : undefined }} collapsed={collapsed && !isMobile} active={isActive(location.pathname, item.path)} onNavigate={go} />)}
          </section>}
        </nav>

        <div className="border-t border-[var(--dv-border)] p-3">
          <button type="button" onClick={() => go('/profile')} className={cn('flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-[var(--dv-nav-hover)]', collapsed && !isMobile && 'justify-center')}>
            <Avatar src={user?.avatar} name={user?.name || 'User'} size="sm" />
            {(!collapsed || isMobile) && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--dv-text)]">{user?.name || (isGuest ? 'Guest' : 'DentVision User')}</span><span className="block truncate text-[11px] text-[var(--dv-muted)]">{isGuest ? 'Demo mode' : 'Personal workspace'}</span></span>}
          </button>
          {!isGuest && (!collapsed || isMobile) && <button type="button" onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-danger)]"><LogOut size={14} /> Sign out</button>}
        </div>
      </motion.aside>
    </>
  );
};

export default SuperAppSidebar;
