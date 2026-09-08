import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, Bot, BriefcaseBusiness, ChevronLeft, ChevronRight,
  Command, Database, FileText, GraduationCap, HelpCircle, LayoutDashboard,
  LogOut, Search, Settings, ShieldCheck, ShoppingBag, Stethoscope, Users,
  UserRound, X, Sparkles, ClipboardList, CalendarDays, PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/ds/Avatar';
import { useIam } from '@/iam';
import type { User as UserType, RoleInfo } from '@/types';
import '@/styles/dentvision-superapp.css';

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

type Item = {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
};

const primary: Item[] = [
  { id: 'ai', label: 'AI Workspace', path: '/', icon: <Sparkles size={18} /> },
  { id: 'practice', label: 'Practice', path: '/crm/schedule', icon: <Stethoscope size={18} /> },
  { id: 'diagnostics', label: 'Diagnostics', path: '/diagnostics', icon: <Activity size={18} /> },
];

const business: Item[] = [
  { id: 'shop', label: 'Shop', path: '/shop', icon: <ShoppingBag size={18} /> },
  { id: 'academy', label: 'Academy', path: '/school', icon: <GraduationCap size={18} /> },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
];

const network: Item[] = [
  { id: 'jobs', label: 'Jobs', path: '/jobs', icon: <BriefcaseBusiness size={18} /> },
  { id: 'community', label: 'Community', path: '/community', icon: <Users size={18} /> },
];

const practiceTools: Item[] = [
  { id: 'schedule', label: 'Schedule', path: '/crm/schedule', icon: <CalendarDays size={17} /> },
  { id: 'patients', label: 'Patients', path: '/crm/patients', icon: <Users size={17} /> },
  { id: 'visits', label: 'Visits', path: '/crm/visits', icon: <ClipboardList size={17} /> },
  { id: 'odontogram', label: 'Odontogram', path: '/crm/dental-chart', icon: <LayoutDashboard size={17} /> },
  { id: 'treatment', label: 'Treatment Plans', path: '/crm/treatment-plans', icon: <FileText size={17} /> },
];

const more: Item[] = [
  { id: 'profile', label: 'Profile', path: '/profile', icon: <UserRound size={17} /> },
  { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings size={17} /> },
  { id: 'help', label: 'Help & Support', path: '/help', icon: <HelpCircle size={17} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  sidebarVisible,
  isMobile,
  sidebarOpen,
  user,
  logout,
  toggleSidebar,
  isGuest = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const iam = useIam();
  const [practiceOpen, setPracticeOpen] = React.useState(location.pathname.startsWith('/crm'));

  const isAdmin = iam.pages.includes('admin');
  const pendingApprovals = 0;
  const adminItems: Item[] = [
    { id: 'admin', label: 'Administration', path: '/admin', icon: <ShieldCheck size={17} /> },
    { id: 'approvals', label: 'AI Approvals', path: '/ai-approvals', icon: <ShieldCheck size={17} />, badge: pendingApprovals || undefined },
    { id: 'agents', label: 'AI Agents', path: '/agent-activity', icon: <Bot size={17} /> },
    { id: 'audit', label: 'Audit & Security', path: '/audit', icon: <Database size={17} /> },
  ];

  React.useEffect(() => {
    if (location.pathname.startsWith('/crm')) setPracticeOpen(true);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const go = (path: string) => {
    navigate(path);
    if (isMobile) toggleSidebar();
  };

  const renderItem = (item: Item) => {
    const active = isActive(item.path);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.path)}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
          collapsed && 'justify-center px-2',
          active ? 'text-[var(--dv-text)]' : 'text-[var(--dv-muted)] hover:text-[var(--dv-text)]',
        )}
      >
        {active && <motion.span layoutId="dv-sidebar-active" className="absolute inset-0 rounded-xl bg-[var(--dv-nav-active)]" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
        <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]' : 'bg-[var(--dv-icon-bg)] group-hover:bg-[var(--dv-nav-hover)]')}>
          {item.icon}
        </span>
        {!collapsed && <span className="relative z-10 min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>}
        {!collapsed && item.badge != null && <span className="relative z-10 rounded-full bg-[var(--dv-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
      </button>
    );
  };

  const section = (title: string, items: Item[]) => (
    <div className="mb-4">
      {!collapsed && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dv-muted-2)]">{title}</div>}
      <div className="space-y-0.5">{items.map(renderItem)}</div>
    </div>
  );

  if (!sidebarVisible && !isMobile) return null;

  return (
    <>
      {isMobile && sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" onClick={toggleSidebar} />}
      <motion.aside
        initial={false}
        animate={{ width: isMobile ? 280 : collapsed ? 76 : 260, x: isMobile ? (sidebarOpen ? 0 : -300) : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--dv-border)] bg-[var(--dv-sidebar)] shadow-[var(--dv-shadow)] lg:relative lg:z-30"
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-[var(--dv-border)] px-3', collapsed && !isMobile ? 'justify-center' : 'justify-between')}>
          {(!collapsed || isMobile) ? (
            <button onClick={() => go('/')} className="flex min-w-0 items-center gap-2.5" aria-label="DentVision home">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dv-accent)] text-white shadow-sm"><Stethoscope size={19} /></div>
              <div className="min-w-0 text-left"><div className="truncate text-[14px] font-bold tracking-tight text-[var(--dv-text)]">DentVision</div><div className="text-[10px] text-[var(--dv-muted-2)]">Dental OS</div></div>
            </button>
          ) : <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--dv-accent)] text-white"><Stethoscope size={19} /></div>}
          {isMobile ? <button onClick={toggleSidebar} className="rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]"><X size={18} /></button> : <button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-1.5 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)]" aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>}
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          <button onClick={() => window.dispatchEvent(new CustomEvent('dentvision:command-center'))} className={cn('mb-4 flex w-full items-center gap-2 rounded-xl border border-[var(--dv-border)] bg-[var(--dv-surface)] px-3 py-2 text-[12px] text-[var(--dv-muted)] hover:border-[var(--dv-border-strong)]', collapsed && !isMobile && 'justify-center px-2')} title="Search anything">
            <Search size={16} />
            {(!collapsed || isMobile) && <><span className="flex-1 text-left">Search anything</span><kbd className="rounded-md border border-[var(--dv-border)] px-1.5 py-0.5 text-[9px]">⌘K</kbd></>}
          </button>

          {section('Workspace', primary)}
          {section('Business', business)}
          {section('Network', network)}

          {isActive('/crm') && (
            <div className="mb-4">
              {!collapsed && <button onClick={() => setPracticeOpen(!practiceOpen)} className="mb-1.5 flex w-full items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dv-muted-2)]">Practice tools <PanelLeft size={12} /></button>}
              <AnimatePresence initial={false}>{practiceOpen && (!collapsed || isMobile) && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-0.5 overflow-hidden pl-1">{practiceTools.map(renderItem)}</motion.div>}</AnimatePresence>
            </div>
          )}

          {isAdmin && section('Administration', adminItems)}
          {section('More', more)}
        </div>

        <div className="shrink-0 border-t border-[var(--dv-border)] p-2.5">
          {!collapsed || isMobile ? (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--dv-surface)] p-2">
              <Avatar src={user?.avatar} name={user?.name || user?.email || 'User'} size="sm" />
              <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold text-[var(--dv-text)]">{user?.name || 'DentVision User'}</div><div className="truncate text-[10px] text-[var(--dv-muted-2)]">{user?.email || (isGuest ? 'Guest mode' : 'Workspace')}</div></div>
              <button onClick={logout} className="rounded-lg p-1.5 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-danger)]" title="Sign out"><LogOut size={15} /></button>
            </div>
          ) : <button onClick={logout} className="mx-auto flex rounded-lg p-2 text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-danger)]" title="Sign out"><LogOut size={16} /></button>}
        </div>
      </motion.aside>
    </>
  );
};
