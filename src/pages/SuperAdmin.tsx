import { useState, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CheckCircle, Ban, AlertTriangle, Users, Banknote, Pencil,
  KeyRound, Trash2, Plus, Shield, UserPlus, Eye, EyeOff, Copy, RefreshCw,
  Search, LifeBuoy, Headphones, UserCheck, Activity, ShoppingCart, GraduationCap,
  Brain, DollarSign, Microscope, BarChart3, Accessibility, Handshake, Gauge,
} from 'lucide-react';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '../components/ui/ds/Button';
import { Card } from '../components/ui/ds/Card';
import { Input, Select } from '../components/ui/ds/Input';
import { Badge } from '../components/ui/ds/Badge';
import { Modal, ConfirmModal } from '../components/ui/ds/Modal';
import { StatCard, PageHeader } from '../components/ui/ds/StatCard';
import { GlassCard } from '../components/ui/ds/GlassCard';
import { Skeleton } from '../components/ui/ds/Skeleton';
import { tg, fd } from '../utils/constants';
import * as api from '@/utils/api';
import { queryKeys } from '@/queries/keys';
import { useAuth } from '@/store/auth.store';

const DiagnosticsTab = lazy(() => import('./superadmin/DiagnosticsTab'));
const MarketplaceTab = lazy(() => import('./superadmin/MarketplaceTab'));
const AcademyTab = lazy(() => import('./superadmin/AcademyTab'));
const AIGovernanceTab = lazy(() => import('./superadmin/AIGovernanceTab'));
const FinanceTab = lazy(() => import('./superadmin/FinanceTab'));
const BITab = lazy(() => import('./superadmin/BITab'));
const OpsTab = lazy(() => import('./superadmin/OpsTab'));
const QualityCenterTab = lazy(() => import('./superadmin/QualityCenterTab'));
const PartnersTab = lazy(() => import('./superadmin/PartnersTab'));
const DataIntelligenceTab = lazy(() => import('./superadmin/DataIntelligenceTab'));
import OrganizationsPage from './admin/OrganizationsPage';
import PersonsPage from './admin/PersonsPage';

const PLANS: Record<string, { name: string; price: string }> = {
  starter: { name: 'Starter', price: '0 ₸' },
  professional: { name: 'Professional', price: '49 900 ₸' },
  enterprise: { name: 'Enterprise', price: '149 900 ₸' },
};

const PLAN_BADGE: Record<string, string> = {
  starter: 'bg-[#4e8cff]/10 text-[#4e8cff] border-[#4e8cff]/20',
  professional: 'bg-dv-gold/10 text-dv-gold border-dv-gold/20',
  enterprise: 'bg-[#9b5de5]/10 text-[#9b5de5] border-[#9b5de5]/20',
};

type Tab = 'dashboard' | 'clinics' | 'users' | 'diagnostics' | 'marketplace' | 'academy' | 'ai-governance' | 'platform-finance' | 'bi' | 'data-intelligence' | 'ops' | 'support' | 'quality' | 'organizations' | 'persons' | 'partners';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
  { id: 'clinics', label: 'Клиники', icon: <Building2 size={16} /> },
  { id: 'users', label: 'Пользователи', icon: <Users size={16} /> },
  { id: 'diagnostics', label: 'Диагностика', icon: <Microscope size={16} /> },
  { id: 'marketplace', label: 'Маркетплейс', icon: <ShoppingCart size={16} /> },
  { id: 'academy', label: 'Academy', icon: <GraduationCap size={16} /> },
  { id: 'partners', label: 'Партнёрская программа', icon: <Handshake size={16} /> },
  { id: 'ai-governance', label: 'AI Governance', icon: <Brain size={16} /> },
  { id: 'platform-finance', label: 'Финансы', icon: <DollarSign size={16} /> },
  { id: 'bi', label: 'BI Аналитика', icon: <BarChart3 size={16} /> },
  { id: 'data-intelligence', label: 'Data Intelligence', icon: <Gauge size={16} /> },
  { id: 'ops', label: 'Ops Center', icon: <Shield size={16} /> },
  { id: 'support', label: 'Поддержка', icon: <LifeBuoy size={16} /> },
  { id: 'quality', label: 'Quality', icon: <Accessibility size={16} /> },
  { id: 'organizations', label: 'Организации', icon: <Building2 size={16} /> },
  { id: 'persons', label: 'Персоны', icon: <Users size={16} /> },
];

// Logical grouping of the tabs so the platform admin isn't a 14-tab flat bar.
const TAB_GROUPS: { id: string; label: string; tabs: Tab[] }[] = [
  { id: 'overview', label: 'Обзор', tabs: ['dashboard'] },
  { id: 'clients', label: 'Клиенты', tabs: ['clinics', 'users', 'support', 'organizations', 'persons'] },
  { id: 'ecosystem', label: 'Экосистема', tabs: ['marketplace', 'academy', 'diagnostics', 'partners'] },
  { id: 'finance', label: 'Финансы и BI', tabs: ['platform-finance', 'bi', 'data-intelligence'] },
  { id: 'control', label: 'Контроль', tabs: ['ai-governance', 'ops', 'quality'] },
];

const TabLoader = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
  </div>
);

export default function SuperAdmin() {
  const toast = useToast();
  const { showToast } = toast;
  const qc = useQueryClient();
  const { user } = useAuth();
  const platformRole = (user as { platformRole?: string } | null)?.platformRole;
  const userRole = user?.role;

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'dashboard');
  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null;
    if (t && TABS.some(tab => tab.id === t)) setTab(t);
  }, [searchParams]);
  const handleTabChange = (t: Tab) => { setTab(t); setSearchParams(t === 'dashboard' ? {} : { tab: t }, { replace: true }); }
  const [search, setSearch] = useState('');

  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: api.getAdminStats, staleTime: 30_000 });
  const clinics = useQuery({ queryKey: queryKeys.admin.clinics, queryFn: api.getAdminClinics, staleTime: 30_000 });
  const users = useQuery({ queryKey: queryKeys.admin.users(), queryFn: () => api.getAdminUsers(), staleTime: 30_000 });
  const support = useQuery({ queryKey: queryKeys.admin.support, queryFn: api.getAdminSupport, staleTime: 30_000 });

  const [clinicModal, setClinicModal] = useState<false | 'create' | 'edit'>(false);
  const [editClinic, setEditClinic] = useState<any>(null);
  const [clinicForm, setClinicForm] = useState({ name: '', city: '', phone: '', address: '', plan: 'starter' });
  const [deleteModal, setDeleteModal] = useState<any>(null);
  const [pwModal, setPwModal] = useState<any>(null);
  /** Пользователь и ассистент, удаление которых ждёт подтверждения. */
  const [toDeleteUser, setToDeleteUser] = useState<any>(null);
  const [toDeleteSupport, setToDeleteSupport] = useState<any>(null);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ login: '', name: '', email: '', role: 'doctor', clinicId: '', password: '' });
  const [newUserPw, setNewUserPw] = useState<string | null>(null);
  const [supportModal, setSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ login: '', name: '', email: '', password: '' });
  const [newSupportPw, setNewSupportPw] = useState<string | null>(null);

  const createClinic = useMutation({
    mutationFn: api.createAdminClinic,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.clinics });
      qc.invalidateQueries({ queryKey: queryKeys.admin.stats });
      showToast(`Клиника создана. Директор: ${d.directorLogin}, пароль: ${d.tempPassword}`, 'success');
      setClinicModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const updateClinic = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.updateAdminClinic(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Клиника обновлена', 'success'); setClinicModal(false); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const toggleClinic = useMutation({
    mutationFn: api.toggleAdminClinic,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Статус обновлён', 'info'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const changePlan = useMutation({
    mutationFn: ({ id, plan }: any) => api.changeAdminClinicPlan(id, plan),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Тариф изменён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const extendSub = useMutation({
    mutationFn: ({ id, months }: any) => api.extendAdminClinic(id, months),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Подписка продлена', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const deleteClinic = useMutation({
    mutationFn: api.deleteAdminClinic,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); qc.invalidateQueries({ queryKey: queryKeys.admin.stats }); showToast('Клиника удалена', 'success'); setDeleteModal(null); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const resetPw = useMutation({
    mutationFn: ({ id, password }: any) => api.resetAdminUserPassword(id, password),
    onSuccess: () => { showToast('Пароль сброшен', 'success'); setPwModal(null); setPw(''); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const createUser = useMutation({
    mutationFn: api.createAdminUser,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      showToast('Пользователь создан', 'success');
      if (d.tempPassword) setNewUserPw(d.tempPassword);
      setUserModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const deleteUser = useMutation({
    mutationFn: api.deleteAdminUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.users() }); showToast('Пользователь удалён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const createSupport = useMutation({
    mutationFn: api.createAdminSupport,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.support });
      showToast('Ассистент создан', 'success');
      if (d.tempPassword) setNewSupportPw(d.tempPassword);
      setSupportModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const deleteSupport = useMutation({
    mutationFn: api.deleteAdminSupport,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.support }); showToast('Ассистент удалён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  if (platformRole !== 'superadmin' && userRole !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const s = stats.data;
  const clinicList = clinics.data || [];
  const userList = users.data || [];
  const supportList = support.data || [];

  const filterBySearch = (list: any[], fields: string[]) =>
    list.filter((item) => !search || fields.some((f) => String(item[f] || '').toLowerCase().includes(search.toLowerCase())));

  const copyToClip = (text: string) => { navigator.clipboard?.writeText(text); showToast('Скопировано', 'info'); };

  const renderTab = () => {
    switch (tab) {
      case 'diagnostics': return <Suspense fallback={<TabLoader />}><DiagnosticsTab /></Suspense>;
      case 'marketplace': return <Suspense fallback={<TabLoader />}><MarketplaceTab /></Suspense>;
      case 'academy': return <Suspense fallback={<TabLoader />}><AcademyTab /></Suspense>;
      case 'partners': return <Suspense fallback={<TabLoader />}><PartnersTab /></Suspense>;
      case 'ai-governance': return <Suspense fallback={<TabLoader />}><AIGovernanceTab /></Suspense>;
      case 'platform-finance': return <Suspense fallback={<TabLoader />}><FinanceTab /></Suspense>;
      case 'bi': return <Suspense fallback={<TabLoader />}><BITab /></Suspense>;
      case 'data-intelligence': return <Suspense fallback={<TabLoader />}><DataIntelligenceTab /></Suspense>;
      case 'ops': return <Suspense fallback={<TabLoader />}><OpsTab /></Suspense>;
      case 'quality': return <Suspense fallback={<TabLoader />}><QualityCenterTab /></Suspense>;
      case 'organizations': return <OrganizationsPage />;
      case 'persons': return <PersonsPage />;
      case 'dashboard': {
        // Attention feed: expiring / expired / blocked clinics, soonest first.
        type AttnRow = { c: any; daysLeft: number | null; blocked: boolean; expiring: boolean; expired: boolean };
        const attention: AttnRow[] = clinicList
          .map((c: any): AttnRow => {
            const end = c.subscription?.endDate ? new Date(c.subscription.endDate) : null;
            const daysLeft = end ? Math.floor((end.getTime() - Date.now()) / 86400000) : null;
            return {
              c,
              daysLeft,
              blocked: !c.active,
              expiring: daysLeft != null && daysLeft >= 0 && daysLeft <= 7,
              expired: daysLeft != null && daysLeft < 0,
            };
          })
          .filter((x: AttnRow) => x.blocked || x.expiring || x.expired)
          .sort((a: AttnRow, b: AttnRow) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
          .slice(0, 8);

        const Stat = ({ label, value, icon, tab }: { label: string; value: string | number; icon: ReactNode; tab: Tab }) => (
          <button type="button" onClick={() => handleTabChange(tab)} className="text-left transition-transform hover:-translate-y-0.5 focus:outline-none">
            <StatCard label={label} value={value} icon={icon} />
          </button>
        );

        return (
          <div className="space-y-6">
            {s && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                <Stat label="Клиник" value={s.totalClinics} icon={<Building2 size={18} />} tab="clinics" />
                <Stat label="Активных" value={s.activeClinics} icon={<CheckCircle size={18} />} tab="clinics" />
                <Stat label="Заблокировано" value={s.blockedClinics} icon={<Ban size={18} />} tab="clinics" />
                <Stat label="Истекают" value={s.expiringSoon} icon={<AlertTriangle size={18} />} tab="clinics" />
                <Stat label="Пользователей" value={s.totalUsers} icon={<Users size={18} />} tab="users" />
                <Stat label="MRR" value={tg(s.mrr)} icon={<Banknote size={18} />} tab="platform-finance" />
              </div>
            )}

            <Card padding="none">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-bdr-subtle">
                <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-2">
                  <AlertTriangle size={15} className="text-warning" /> Требуют внимания
                </h3>
                <button onClick={() => handleTabChange('clinics')} className="text-xs text-dv-gold hover:text-dv-gold-light min-h-11">Все клиники</button>
              </div>
              {attention.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-txt-muted">Всё в порядке — нет истекающих или заблокированных клиник.</div>
              ) : (
                <div className="divide-y divide-bdr-subtle/60">
                  {attention.map(({ c, daysLeft, blocked, expired }) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-txt-primary truncate">{c.name}</div>
                        <div className="text-xs text-txt-muted">{c.city || '—'} · {PLANS[c.plan]?.name || c.plan}</div>
                      </div>
                      <Badge size="sm" variant={blocked ? 'error' : expired ? 'error' : 'warning'} dot>
                        {blocked ? 'Заблокирована' : expired ? 'Истекла' : `Истекает через ${daysLeft} дн.`}
                      </Badge>
                      <div className="flex gap-1">
                        {blocked ? (
                          <Button size="xs" variant="ghost" className="min-h-11" onClick={() => toggleClinic.mutate(c.id)}>Активировать</Button>
                        ) : (
                          <>
                            <Button size="xs" variant="ghost" className="min-h-11" onClick={() => extendSub.mutate({ id: c.id, months: 1 })}>+1 мес</Button>
                            <Button size="xs" variant="ghost" className="min-h-11" onClick={() => extendSub.mutate({ id: c.id, months: 3 })}>+3 мес</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassCard padding="md">
                <h3 className="text-sm font-semibold text-txt-primary mb-2">Активность сегодня</h3>
                <p className="text-2xl font-bold text-dv-gold">{s?.todayAppointments || 0}</p>
                <p className="text-xs text-txt-muted mt-1">приёмов</p>
              </GlassCard>
              <GlassCard padding="md">
                <h3 className="text-sm font-semibold text-txt-primary mb-2">Новых клиник</h3>
                <p className="text-2xl font-bold text-success">{s?.newClinicsThisMonth || 0}</p>
                <p className="text-xs text-txt-muted mt-1">в этом месяце</p>
              </GlassCard>
              <GlassCard padding="md">
                <h3 className="text-sm font-semibold text-txt-primary mb-2">Поддержка</h3>
                <p className="text-2xl font-bold text-txt-primary">{s?.supportActive || 0}</p>
                <p className="text-xs text-txt-muted mt-1">активных ассистентов</p>
              </GlassCard>
            </div>
          </div>
        );
      }
      case 'clinics': return (
        <>
          <div className="flex flex-wrap justify-end mb-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                  className="pl-8 pr-3 py-1.5 min-h-11 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
              </div>
              <Button icon={<Plus size={16} />} className="min-h-11" onClick={() => { setEditClinic(null); setClinicForm({ name: '', city: '', phone: '', address: '', plan: 'starter' }); setClinicModal('create'); }}>Клиника</Button>
            </div>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bdr-subtle">
                    {['Клиника', 'Контакты', 'Тариф', 'Подписка', 'Статус', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filterBySearch(clinicList, ['name', 'city']).map((c: any) => {
                      const sub = c.subscription;
                      const endDate = sub?.endDate ? new Date(sub.endDate) : null;
                      const daysLeft = endDate ? Math.floor((endDate.getTime() - Date.now()) / 86400000) : null;
                      const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                      const isExpired = daysLeft !== null && daysLeft < 0;
                      return (
                        <motion.tr key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-bdr-subtle/50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-txt-primary">{c.name}</div>
                            <div className="text-xs text-txt-muted">{c.city || '—'} · {c._count?.memberships ?? 0} сотр. · {c._count?.patients ?? 0} пациен.</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary">
                            <div>{c.phone || '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge size="sm" className={PLAN_BADGE[c.plan || '']}>{PLANS[c.plan]?.name || c.plan}</Badge>
                            <div className="mt-1">
                              <Select value={c.plan || ''} onChange={e => changePlan.mutate({ id: c.id, plan: e.target.value })}
                                options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: v.name }))} className="w-auto min-w-[90px] h-7 text-xs px-2" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {endDate ? (
                              <div>
                                <div className={`text-xs font-medium ${isExpired ? 'text-error' : isExpiring ? 'text-warning' : 'text-txt-muted'}`}>
                                  {isExpired ? 'Истекла' : `${daysLeft} дн.`}
                                </div>
                                <div className="text-xs text-txt-muted mb-1">{fd(sub.endDate)}</div>
                                <div className="flex gap-1">
                                  <Button size="xs" variant="ghost" className="min-h-11" onClick={() => extendSub.mutate({ id: c.id, months: 1 })}>+1</Button>
                                  <Button size="xs" variant="ghost" className="min-h-11" onClick={() => extendSub.mutate({ id: c.id, months: 3 })}>+3</Button>
                                </div>
                              </div>
                            ) : <span className="text-xs text-txt-muted">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={c.active ? 'success' : 'error'} size="sm" dot>{c.active ? 'Активна' : 'Заблокирована'}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button size="icon-sm" variant="ghost" className="min-h-11" aria-label="Редактировать" onClick={() => { setEditClinic(c); setClinicForm({ name: c.name, city: c.city || '', phone: c.phone || '', address: c.address || '', plan: c.plan || 'starter' }); setClinicModal('edit'); }}><Pencil size={14} /></Button>
                              <Button size="icon-sm" variant="ghost" className="min-h-11" aria-label={c.active ? 'Заблокировать' : 'Активировать'} onClick={() => toggleClinic.mutate(c.id)}>{c.active ? <Ban size={14} /> : <CheckCircle size={14} />}</Button>
                              <Button size="icon-sm" variant="danger" className="min-h-11" aria-label="Удалить" onClick={() => setDeleteModal(c)}><Trash2 size={14} /></Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {clinicList.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-txt-muted text-sm">Нет клиник</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      );
      case 'users': return (
        <>
          <div className="flex flex-wrap justify-end mb-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                  className="pl-8 pr-3 py-1.5 min-h-11 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
              </div>
              <Button icon={<UserPlus size={16} />} className="min-h-11" onClick={() => { setUserForm({ login: '', name: '', email: '', role: 'doctor', clinicId: '', password: '' }); setNewUserPw(null); setUserModal(true); }}>Пользователь</Button>
            </div>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bdr-subtle">
                    {['Пользователь', 'Логин', 'Роль', 'Клиника', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filterBySearch(userList, ['name', 'login', 'email']).map((u: any) => (
                    <tr key={u.id} className="border-b border-bdr-subtle/50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary">{u.name}</div>
                        <div className="text-xs text-txt-muted">{u.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-txt-secondary">{u.login}</td>
                      <td className="px-4 py-3"><Badge size="xs">{u.role}</Badge></td>
                      <td className="px-4 py-3 text-sm text-txt-muted">{u.clinicName || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="icon-sm" variant="ghost" className="min-h-11" title="Reset password" onClick={() => { setPwModal(u); setPw(''); }}><KeyRound size={14} /></Button>
                          <Button size="icon-sm" variant="danger" className="min-h-11" title="Delete user" onClick={() => setToDeleteUser(u)}><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {userList.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-txt-muted text-sm">Нет пользователей</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      );
      case 'support': return (
        <>
          <div className="flex flex-wrap justify-end mb-2">
            <Button icon={<Headphones size={16} />} className="min-h-11" onClick={() => { setSupportForm({ login: '', name: '', email: '', password: '' }); setNewSupportPw(null); setSupportModal(true); }}>Ассистент</Button>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bdr-subtle">
                    {['Ассистент', 'Логин', 'Email', 'Создан', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supportList.map((u: any) => (
                    <tr key={u.id} className="border-b border-bdr-subtle/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-dv-gold/10 flex items-center justify-center text-dv-gold"><Headphones size={14} /></div>
                          <div><div className="text-sm font-semibold text-txt-primary">{u.name}</div><Badge size="xs" className="mt-0.5">{u.platformRole || u.role}</Badge></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-txt-secondary">{u.login}</td>
                      <td className="px-4 py-3 text-sm text-txt-muted">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{u.createdAt ? fd(u.createdAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <Button size="icon-sm" variant="danger" className="min-h-11" title="Delete assistant" onClick={() => setToDeleteSupport(u)}><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                  {supportList.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-txt-muted text-sm">Нет ассистентов. Нажмите "Ассистент" чтобы добавить.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      );
      default: return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Управление платформой"
        subtitle="DentVision Platform Admin"
        icon={<Shield size={20} />}
                actions={<Button icon={<RefreshCw size={16} />} variant="ghost" className="min-h-11" onClick={() => qc.invalidateQueries()}>Обновить</Button>}
      />

      {(() => {
        const activeGroup = TAB_GROUPS.find((g) => g.tabs.includes(tab)) || TAB_GROUPS[0];
        const groupTabs = TABS.filter((t) => activeGroup.tabs.includes(t.id));
        return (
          <div className="space-y-2">
            <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
              {TAB_GROUPS.map((g) => {
                const active = g.id === activeGroup.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => { handleTabChange(g.tabs.includes(tab) ? tab : g.tabs[0]); setSearch(''); }}
                    className={`px-3.5 py-1.5 min-h-11 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            {groupTabs.length > 1 && (
              <div className="flex gap-1 overflow-x-auto px-0.5">
                {groupTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { handleTabChange(t.id); setSearch(''); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-md text-sm whitespace-nowrap transition-colors ${tab === t.id ? 'bg-dv-gold/10 text-dv-gold font-medium' : 'text-txt-muted hover:text-txt-secondary'}`}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {renderTab()}

      <Modal open={!!clinicModal} onClose={() => setClinicModal(false)} title={clinicModal === 'edit' ? 'Редактировать клинику' : 'Новая клиника'}>
        <form onSubmit={e => { e.preventDefault(); if (!clinicForm.name.trim()) { showToast('Введите название', 'warning'); return; } if (clinicModal === 'edit' && editClinic) updateClinic.mutate({ id: editClinic.id, ...clinicForm }); else createClinic.mutate(clinicForm); }} className="space-y-4 max-w-full overflow-x-hidden">
          <Input label="Название *" value={clinicForm.name} onChange={e => setClinicForm({ ...clinicForm, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Город" value={clinicForm.city} onChange={e => setClinicForm({ ...clinicForm, city: e.target.value })} />
            <Input label="Телефон" value={clinicForm.phone} onChange={e => setClinicForm({ ...clinicForm, phone: e.target.value })} />
          </div>
          <Input label="Адрес" value={clinicForm.address} onChange={e => setClinicForm({ ...clinicForm, address: e.target.value })} />
          {clinicModal === 'create' && (
            <Select label="Тариф" value={clinicForm.plan} onChange={e => setClinicForm({ ...clinicForm, plan: e.target.value })}
              options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.price})` }))} />
          )}
          {clinicModal === 'create' && (
            <div className="bg-dv-gold/5 border border-dv-gold/20 rounded-lg p-3 text-xs text-txt-secondary">
              Будет создан аккаунт директора с логином <code>admin_&lt;slug&gt;</code> и временным паролем.
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="min-h-11" loading={createClinic.isPending || updateClinic.isPending}>{clinicModal === 'edit' ? 'Сохранить' : 'Создать клинику'}</Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setClinicModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={userModal} onClose={() => { setUserModal(false); setNewUserPw(null); }} title="Новый пользователь">
        {newUserPw ? (
          <div className="space-y-4 max-w-full overflow-x-hidden">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
              <UserCheck size={24} className="mx-auto text-success mb-2" />
              <p className="text-sm text-txt-primary font-medium">Пользователь создан!</p>
              <p className="text-xs text-txt-muted mt-1">Пароль:</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="text-lg font-mono text-dv-gold bg-surface-2 px-3 py-1 rounded">{newUserPw}</code>
                <Button size="icon-sm" variant="ghost" title="Copy password" onClick={() => copyToClip(newUserPw)}><Copy size={14} /></Button>
              </div>
            </div>
            <Button className="w-full min-h-11" onClick={() => setNewUserPw(null)}>Готово</Button>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (!userForm.login.trim() || !userForm.name.trim()) { showToast('Логин и имя обязательны', 'warning'); return; } createUser.mutate(userForm); }} className="space-y-4 max-w-full overflow-x-hidden">
            <Input label="Логин *" value={userForm.login} onChange={e => setUserForm({ ...userForm, login: e.target.value })} required />
            <Input label="Имя *" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required />
            <Input label="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} type="email" />
            <Select label="Роль" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
              options={[{ value: 'doctor', label: 'Врач' }, { value: 'assistant', label: 'Ассистент' }, { value: 'admin', label: 'Администратор' }, { value: 'reception', label: 'Регистратор' }, { value: 'manager', label: 'Менеджер' }, { value: 'laboratory', label: 'Лаборант' }, { value: 'owner', label: 'Руководитель' }]} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" className="min-h-11" loading={createUser.isPending}>Создать</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setUserModal(false)}>Отмена</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={supportModal} onClose={() => { setSupportModal(false); setNewSupportPw(null); }} title="Новый ассистент поддержки">
        {newSupportPw ? (
          <div className="space-y-4 max-w-full overflow-x-hidden">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
              <Headphones size={24} className="mx-auto text-success mb-2" />
              <p className="text-sm text-txt-primary font-medium">Ассистент создан!</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="text-lg font-mono text-dv-gold bg-surface-2 px-3 py-1 rounded">{newSupportPw}</code>
                <Button size="icon-sm" variant="ghost" title="Copy password" onClick={() => copyToClip(newSupportPw)}><Copy size={14} /></Button>
              </div>
            </div>
            <Button className="w-full min-h-11" onClick={() => setNewSupportPw(null)}>Готово</Button>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (!supportForm.login.trim() || !supportForm.name.trim()) { showToast('Логин и имя обязательны', 'warning'); return; } createSupport.mutate(supportForm); }} className="space-y-4 max-w-full overflow-x-hidden">
            <Input label="Логин *" value={supportForm.login} onChange={e => setSupportForm({ ...supportForm, login: e.target.value })} required />
            <Input label="Имя *" value={supportForm.name} onChange={e => setSupportForm({ ...supportForm, name: e.target.value })} required />
            <Input label="Email" value={supportForm.email} onChange={e => setSupportForm({ ...supportForm, email: e.target.value })} type="email" />
            <div className="bg-dv-gold/5 border border-dv-gold/20 rounded-lg p-3 text-xs text-txt-secondary">
              Ассистент получит роль <strong>support</strong> — доступ к аналитике, настройкам и управлению платформой.
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" className="min-h-11" loading={createSupport.isPending}>Создать</Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setSupportModal(false)}>Отмена</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!pwModal} onClose={() => { setPwModal(null); setPw(''); }} title={`Сброс пароля: ${pwModal?.name || ''}`}>
        <form onSubmit={e => { e.preventDefault(); if (!pw || pw.length < 6) { showToast('Минимум 6 символов', 'warning'); return; } resetPw.mutate({ id: pwModal.id, password: pw }); }} className="space-y-4 max-w-full overflow-x-hidden">
          <div className="text-sm text-txt-secondary">Логин: <strong className="text-txt-primary font-mono">{pwModal?.login}</strong></div>
          <div className="relative">
            <Input label="Новый пароль *" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="Минимум 6 символов" required />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-9 text-txt-muted hover:text-txt-primary">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="min-h-11" loading={resetPw.isPending}>Сбросить</Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setPwModal(null); setPw(''); }}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Удаление клиники" size="sm">
        <div className="max-w-full overflow-x-hidden">
          <AlertTriangle size={20} className="text-warning mb-3" />
          <div className="text-sm text-txt-secondary mb-6">
            Удалить клинику <strong className="text-txt-primary">{deleteModal?.name}</strong>?<br /><br />
            Это действие необратимо. Все данные будут удалены.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" className="flex-1 min-h-11" loading={deleteClinic.isPending} onClick={() => deleteClinic.mutate(deleteModal.id)}>Удалить</Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setDeleteModal(null)}>Отмена</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!toDeleteUser}
        onClose={() => setToDeleteUser(null)}
        onConfirm={() => { if (toDeleteUser) deleteUser.mutate(toDeleteUser.id); }}
        title="Удалить пользователя?"
        message={toDeleteUser ? `«${toDeleteUser.name}» потеряет доступ к системе. Действие необратимо.` : ''}
        confirmLabel="Удалить"
      />

      <ConfirmModal
        open={!!toDeleteSupport}
        onClose={() => setToDeleteSupport(null)}
        onConfirm={() => { if (toDeleteSupport) deleteSupport.mutate(toDeleteSupport.id); }}
        title="Удалить ассистента поддержки?"
        message={toDeleteSupport ? `«${toDeleteSupport.name}» потеряет доступ к панели поддержки. Действие необратимо.` : ''}
        confirmLabel="Удалить"
      />
    </motion.div>
  );
}
