import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, Building2, FlaskConical, Users,
  ClipboardList, Calendar, BarChart3, Settings, ChevronRight,
  Microscope, TestTube, Shield, PenLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';

const DIAG_SUBNAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/diagnostics', icon: <LayoutDashboard size={16} /> },
  { id: 'referrals', label: 'Мои направления', path: '/diagnostics/referrals', icon: <FileText size={16} /> },
  { id: 'center-dashboard', label: 'Центр панель', path: '/diagnostics/center-dashboard', icon: <Microscope size={16} />, orgType: 'DIAGNOSTIC_CENTER' },
  { id: 'lab-dashboard', label: 'Лаборатория панель', path: '/diagnostics/lab-dashboard', icon: <TestTube size={16} />, orgType: 'LABORATORY' },
  { id: 'centers', label: 'Диагностические центры', path: '/diagnostics/centers', icon: <Building2 size={16} /> },
  { id: 'laboratories', label: 'Лаборатории', path: '/diagnostics/laboratories', icon: <FlaskConical size={16} /> },
  { id: 'patients', label: 'Пациенты', path: '/diagnostics/patients', icon: <Users size={16} /> },
  { id: 'results', label: 'Результаты', path: '/diagnostics/results', icon: <ClipboardList size={16} /> },
  { id: 'calendar', label: 'Календарь', path: '/diagnostics/calendar', icon: <Calendar size={16} /> },
  { id: 'statistics', label: 'Статистика', path: '/diagnostics/statistics', icon: <BarChart3 size={16} /> },
  { id: 'settings', label: 'Настройки', path: '/diagnostics/settings', icon: <Settings size={16} /> },
  { id: 'register', label: 'Регистрация', path: '/register-diagnostics', icon: <PenLine size={16} /> },
  { id: 'registrations', label: 'Заявки', path: '/diagnostics/registrations', icon: <Shield size={16} />, platformRole: 'superadmin' },
];

export default function DiagnosticsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();
  const platformRole = user?.platformRole || role;
  const orgType = user?.organizationType || '';
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === '/diagnostics') return location.pathname === '/diagnostics';
    return location.pathname.startsWith(path);
  };

  const visibleItems = useMemo(() =>
    DIAG_SUBNAV.filter(item => {
      if (item.platformRole) return item.platformRole === platformRole;
      if (item.orgType) return item.orgType === orgType;
      return true;
    }),
  [platformRole, orgType]);

  return (
    <div className="flex h-full gap-0">
      {/* Left sub-navigation */}
      <motion.nav
        animate={{ width: collapsed ? 56 : 220 }}
        className="shrink-0 bg-surface-2/50 border-r border-bdr-subtle flex flex-col py-3 overflow-hidden"
      >
        <div className="px-3 pb-3 mb-2 border-b border-bdr-subtle/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-xs font-bold text-txt-muted uppercase tracking-wider hover:text-txt-primary transition-colors w-full"
          >
            <ChevronRight size={14} className={cn('transition-transform', collapsed ? 'rotate-180' : '')} />
            {!collapsed && <span>Diagnostics</span>}
          </button>
        </div>
        <div className="flex-1 space-y-0.5 px-2 overflow-y-auto">
          {visibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm transition-all',
                isActive(item.path)
                  ? 'bg-dv-gold/10 text-dv-gold font-medium'
                  : 'text-txt-muted hover:text-txt-primary hover:bg-surface-1/50'
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </div>
      </motion.nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
