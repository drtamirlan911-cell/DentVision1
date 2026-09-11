import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MoreHorizontal, LogIn, LayoutDashboard, FileText, ClipboardList, Calendar, Building2, FlaskConical, Users, BarChart3, Settings, PenLine, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

const CLINIC_ONLY_ITEMS = new Set(['referrals', 'centers', 'laboratories', 'register']);

const DIAG_SUBNAV = [
  { id: 'dashboard', label: 'Обзор', path: '/diagnostics', icon: LayoutDashboard },
  { id: 'referrals', label: 'Направления', path: '/diagnostics/referrals', icon: FileText },
  { id: 'center-dashboard', label: 'Центр', path: '/diagnostics/center-dashboard', icon: Building2, orgType: 'DIAGNOSTIC_CENTER' },
  { id: 'lab-dashboard', label: 'Лаборатория', path: '/diagnostics/lab-dashboard', icon: FlaskConical, orgType: 'LABORATORY' },
  { id: 'centers', label: 'Центры', path: '/diagnostics/centers', icon: Building2 },
  { id: 'laboratories', label: 'Лаборатории', path: '/diagnostics/laboratories', icon: FlaskConical },
  { id: 'patients', label: 'Пациенты', path: '/diagnostics/patients', icon: Users },
  { id: 'results', label: 'Результаты', path: '/diagnostics/results', icon: ClipboardList },
  { id: 'calendar', label: 'Календарь', path: '/diagnostics/calendar', icon: Calendar },
  { id: 'statistics', label: 'Статистика', path: '/diagnostics/statistics', icon: BarChart3 },
  { id: 'settings', label: 'Настройки', path: '/diagnostics/settings', icon: Settings },
  { id: 'register', label: 'Регистрация', path: '/register-diagnostics', icon: PenLine },
  { id: 'registrations', label: 'Заявки', path: '/diagnostics/registrations', icon: Shield, platformRole: 'superadmin' },
];

export default function DiagnosticsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useAuth();
  const platformRole = user?.platformRole || role;
  const orgType = user?.organizationType || '';
  const [orgContexts, setOrgContexts] = useState<any[]>([]);
  const [switching, setSwitching] = useState(false);
  const [ctxErr, setCtxErr] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  const loadContexts = useCallback(async () => {
    try {
      const res = await api.getMyContexts();
      setOrgContexts(res.contexts || []);
    } catch { /* context switching is optional */ }
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
  if (centerCtx && !inCenter) cabinetButtons.push({ key: 'center', label: centerCtx.name ? `Центр: ${centerCtx.name}` : 'Диагностический центр', scopeType: 'DIAGNOSTIC_CENTER', scopeId: centerCtx.scopeId, organizationId: centerCtx.organizationId });
  if (labCtx && !inLab) cabinetButtons.push({ key: 'lab', label: labCtx.name ? `Лаборатория: ${labCtx.name}` : 'Лаборатория', scopeType: 'LABORATORY', scopeId: labCtx.scopeId, organizationId: labCtx.organizationId });
  if ((inCenter || inLab) && clinicCtx) cabinetButtons.push({ key: 'exit', label: 'Вернуться в клинику', scopeType: 'CLINIC', scopeId: clinicCtx.scopeId, organizationId: clinicCtx.organizationId });

  const isActive = (path: string) => path === '/diagnostics' ? location.pathname === '/diagnostics' : location.pathname.startsWith(path);
  const isReceivingOrg = orgType === 'DIAGNOSTIC_CENTER' || orgType === 'LABORATORY';
  const visibleItems = useMemo(() => DIAG_SUBNAV.filter(item => {
    if (item.platformRole) return item.platformRole === platformRole;
    if (item.orgType) return item.orgType === orgType;
    if (isReceivingOrg && CLINIC_ONLY_ITEMS.has(item.id)) return false;
    return true;
  }), [platformRole, orgType, isReceivingOrg]);

  // Diagnostics is one workspace, not a second application inside DentVision.
  // Keep only the few actions users need repeatedly in a compact contextual bar;
  // everything else is behind "Ещё" rather than a second permanent sidebar.
  const primaryIds = inCenter ? ['center-dashboard', 'results', 'calendar'] : inLab ? ['lab-dashboard', 'results', 'calendar'] : ['dashboard', 'referrals', 'results'];
  const primaryItems = primaryIds.map(id => visibleItems.find(item => item.id === id)).filter(Boolean) as typeof visibleItems;
  const secondaryItems = visibleItems.filter(item => !primaryIds.includes(item.id));

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-bdr-subtle bg-surface-1/95 backdrop-blur-xl">
        <div className="flex min-h-14 items-center gap-2 px-3 sm:px-5">
          <div className="mr-1 shrink-0">
            <div className="text-sm font-semibold text-txt-primary">Диагностика</div>
            <div className="hidden text-[11px] text-txt-muted sm:block">Направления, результаты и диагностические центры</div>
          </div>

          <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
            {primaryItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => navigate(item.path)}
                  className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors', isActive(item.path) ? 'bg-dv-gold/10 text-dv-gold font-medium' : 'text-txt-muted hover:bg-surface-2 hover:text-txt-primary')}>
                  <Icon size={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
            {secondaryItems.length > 0 && (
              <div className="relative shrink-0">
                <button onClick={() => setMoreOpen(v => !v)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-txt-muted hover:bg-surface-2 hover:text-txt-primary', moreOpen && 'bg-surface-2 text-txt-primary')}>
                  <MoreHorizontal size={16} />
                  <span className="hidden sm:inline">Ещё</span>
                </button>
                {moreOpen && (
                  <>
                    <button aria-label="Закрыть меню" className="fixed inset-0 z-30 cursor-default" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-bdr-subtle bg-surface-1 p-2 shadow-2xl">
                      {secondaryItems.map(item => {
                        const Icon = item.icon;
                        return <button key={item.id} onClick={() => { setMoreOpen(false); navigate(item.path); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-txt-muted hover:bg-surface-2 hover:text-txt-primary"><Icon size={16} />{item.label}</button>;
                      })}
                      {cabinetButtons.length > 0 && <div className="my-1 border-t border-bdr-subtle" />}
                      {cabinetButtons.map(b => <button key={b.key} onClick={() => { setMoreOpen(false); switchTo(b.scopeType, b.organizationId || b.scopeId); }} disabled={switching} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-txt-muted hover:bg-surface-2 hover:text-txt-primary disabled:opacity-50"><LogIn size={16} />{b.label}</button>)}
                      {ctxErr && <p className="px-3 py-1 text-xs text-red-400">{ctxErr}</p>}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
