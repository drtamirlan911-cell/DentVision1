import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FileText, Building2, FlaskConical, Users,
  ClipboardList, Calendar, BarChart3, Settings, ChevronRight,
  Microscope, TestTube, Shield, PenLine, LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

// Orgs that receive referrals (lab/center) don't author them — these items are
// the clinic's own outbound tooling (send a referral, browse the platform's
// directory of centres/labs to pick where to send it, apply as a new partner)
// and were previously shown to every role including the receiving side.
const CLINIC_ONLY_ITEMS = new Set(['referrals', 'centers', 'laboratories', 'register']);

const DIAG_SUBNAV = [
  { id: 'dashboard', label: 'Обзор', path: '/diagnostics', icon: <LayoutDashboard size={16} /> },
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
  const [orgContexts, setOrgContexts] = useState<any[]>([]);
  const [switching, setSwitching] = useState(false);
  const [ctxErr, setCtxErr] = useState('');

  const loadContexts = useCallback(async () => {
    try {
      const res = await api.getMyContexts();
      setOrgContexts(res.contexts || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadContexts(); }, [loadContexts]);

  const switchTo = useCallback(async (scopeType: string, scopeId: string) => {
    if (switching || !scopeId) return;
    setSwitching(true);
    setCtxErr('');
    try {
      const res = await api.switchContext(scopeType, scopeId);
      if (res?.accessToken) {
        api.setTokens(res.accessToken, res.refreshToken || null);
        window.location.reload();
        return;
      }
      setCtxErr('Сервер не выдал токен доступа');
    } catch (e: any) {
      setCtxErr(e?.message || 'Не удалось переключить кабинет');
    } finally {
      setSwitching(false);
    }
  }, [switching]);

  const inCenter = orgType === 'DIAGNOSTIC_CENTER';
  const inLab = orgType === 'LABORATORY';
  const centerCtx = orgContexts.find((c: any) => c.scopeType === 'DIAGNOSTIC_CENTER');
  const labCtx = orgContexts.find((c: any) => c.scopeType === 'LABORATORY');
  const clinicCtx = orgContexts.find((c: any) => c.scopeType === 'CLINIC');

  const cabinetButtons: Array<{ key: string; label: string; scopeType: string; scopeId: string; organizationId?: string }> = [];
  if (centerCtx && !inCenter) cabinetButtons.push({ key: 'center', label: `Войти в центр${centerCtx.name ? `: ${centerCtx.name}` : ''}`, scopeType: 'DIAGNOSTIC_CENTER', scopeId: centerCtx.scopeId, organizationId: centerCtx.organizationId });
  if (labCtx && !inLab) cabinetButtons.push({ key: 'lab', label: `Войти в лабораторию${labCtx.name ? `: ${labCtx.name}` : ''}`, scopeType: 'LABORATORY', scopeId: labCtx.scopeId, organizationId: labCtx.organizationId });
  if ((inCenter || inLab) && clinicCtx) cabinetButtons.push({ key: 'exit', label: 'Выйти из кабинета', scopeType: 'CLINIC', scopeId: clinicCtx.scopeId, organizationId: clinicCtx.organizationId });

  const isActive = (path: string) => {
    if (path === '/diagnostics') return location.pathname === '/diagnostics';
    return location.pathname.startsWith(path);
  };

  const isReceivingOrg = orgType === 'DIAGNOSTIC_CENTER' || orgType === 'LABORATORY';
  const visibleItems = useMemo(() =>
    DIAG_SUBNAV.filter(item => {
      if (item.platformRole) return item.platformRole === platformRole;
      if (item.orgType) return item.orgType === orgType;
      if (isReceivingOrg && CLINIC_ONLY_ITEMS.has(item.id)) return false;
      return true;
    }),
  [platformRole, orgType, isReceivingOrg]);

  return (
    <div className="flex h-full gap-0 max-w-full overflow-x-hidden">
      {/* Left sub-navigation */}
      <motion.nav
        animate={{ width: collapsed ? 56 : 220 }}
        className="shrink-0 bg-surface-2/50 border-r border-bdr-subtle flex flex-col py-3 overflow-hidden max-md:!w-14"
      >
        <div className="px-3 pb-3 mb-2 border-b border-bdr-subtle/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 text-xs font-bold text-txt-muted uppercase tracking-wider hover:text-txt-primary transition-colors w-full min-h-11"
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
                'flex items-center gap-2.5 w-full px-2.5 py-2 min-h-11 rounded-lg text-sm transition-all',
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

        {cabinetButtons.length > 0 && (
          <div className="mt-2 pt-2 border-t border-bdr-subtle/50 px-2 space-y-0.5">
            {!collapsed && <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider px-2.5 py-1">Мои кабинеты</p>}
            {cabinetButtons.map((b) => (
              <button
                key={b.key}
                onClick={() => switchTo(b.scopeType, b.organizationId || b.scopeId)}
                disabled={switching}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 min-h-11 rounded-lg text-sm text-txt-muted hover:text-txt-primary hover:bg-surface-1/50 transition-all disabled:opacity-50"
              >
                <LogIn size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{b.label}</span>}
              </button>
            ))}
            {ctxErr && !collapsed && <p className="px-2.5 pt-1 text-xs text-red-400">{ctxErr}</p>}
          </div>
        )}
      </motion.nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
