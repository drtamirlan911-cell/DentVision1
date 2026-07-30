import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard, PageHeader, GlassCard, Card, CardContent, Button, Badge, Modal,
  Input, Select, EmptyState, Skeleton, Pagination,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import * as api from '../../utils/api';
import { queryKeys } from '../../queries/keys';
import {
  Microscope, Building2, FlaskConical, FileCheck, AlertTriangle, Check, X,
  Eye, Search, Plus, RefreshCw, Settings, DollarSign, Activity, Users, Clock,
} from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const fmtKzt = (n: number) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₸';

const REFERRAL_PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'SENT', label: 'Отправлен' },
  { value: 'ACCEPTED', label: 'Принят' },
  { value: 'SCHEDULED', label: 'Запланирован' },
  { value: 'PATIENT_ARRIVED', label: 'Пациент прибыл' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'COMPLETED', label: 'Завершён' },
  { value: 'CANCELLED', label: 'Отменён' },
  { value: 'REVIEWED', label: 'Просмотрен' },
];

const STATUS_BADGE: Record<string, 'success' | 'error' | 'warning' | 'gold' | 'info' | 'default'> = {
  COMPLETED: 'success',
  REVIEWED: 'success',
  CANCELLED: 'error',
  PENDING: 'warning',
  SENT: 'info',
  ACCEPTED: 'info',
  SCHEDULED: 'gold',
  PATIENT_ARRIVED: 'info',
  IN_PROGRESS: 'gold',
};

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Отправлен',
  ACCEPTED: 'Принят',
  SCHEDULED: 'Запланирован',
  PATIENT_ARRIVED: 'Прибыл',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  REVIEWED: 'Просмотрен',
  PENDING: 'Ожидает',
};

type SubTab = 'overview' | 'referrals' | 'centers' | 'labs' | 'registrations' | 'commissions';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Activity size={14} /> },
  { id: 'referrals', label: 'Направления', icon: <FileCheck size={14} /> },
  { id: 'centers', label: 'Центры', icon: <Building2 size={14} /> },
  { id: 'labs', label: 'Лаборатории', icon: <FlaskConical size={14} /> },
  { id: 'registrations', label: 'Заявки', icon: <Users size={14} /> },
  { id: 'commissions', label: 'Комиссии', icon: <DollarSign size={14} /> },
];

export default function DiagnosticsTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [search, setSearch] = useState('');

  const [refStatus, setRefStatus] = useState('');
  const [refSearch, setRefSearch] = useState('');
  const [refPage, setRefPage] = useState(1);
  const [refDetail, setRefDetail] = useState<any>(null);

  const [centerModal, setCenterModal] = useState<false | 'create' | 'edit'>(false);
  const [editCenter, setEditCenter] = useState<any>(null);
  const [centerForm, setCenterForm] = useState({ name: '', city: '', phone: '', email: '', address: '' });
  const [pricingModal, setPricingModal] = useState<any>(null);
  const [pricingItems, setPricingItems] = useState<{ id: string; name: string; price: number }[]>([]);

  const [labModal, setLabModal] = useState<false | 'create' | 'edit'>(false);
  const [editLab, setEditLab] = useState<any>(null);
  const [labForm, setLabForm] = useState({ name: '', city: '', phone: '', email: '' });

  const [commissionForm, setCommissionForm] = useState({ centerId: '', labId: '', percentBps: '', description: '' });

  const stats = useQuery({ queryKey: ['diagnostics', 'stats'], queryFn: api.getDiagnosticsStats, staleTime: 30_000 });
  const centers = useQuery({ queryKey: queryKeys.diagnostics.centers(), queryFn: () => api.getDiagnosticCenters(), staleTime: 30_000 });
  const labs = useQuery({ queryKey: queryKeys.diagnostics.labs(), queryFn: () => api.getDiagnosticLaboratories(), staleTime: 30_000 });
  const registrations = useQuery({ queryKey: ['diagnostics', 'registrations'], queryFn: () => api.getDiagnosticsRegistrations(), staleTime: 30_000 });
  const commissionRules = useQuery({ queryKey: ['diagnostics', 'commissionRules'], queryFn: api.getDiagnosticsCommissionRules, staleTime: 30_000 });

  const refParams: Record<string, string> = { page: String(refPage), limit: String(REFERRAL_PAGE_SIZE) };
  if (refStatus) refParams.status = refStatus;
  if (refSearch) refParams.search = refSearch;
  const referrals = useQuery({ queryKey: queryKeys.diagnostics.referrals(refParams), queryFn: () => api.getDiagnosticReferrals(refParams), staleTime: 10_000 });

  const createCenter = useMutation({
    mutationFn: api.createDiagnosticCenter,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.diagnostics.centers() }); toast.success('Центр создан'); setCenterModal(false); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const updateCenter = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.updateDiagnosticCenter(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.diagnostics.centers() }); toast.success('Центр обновлён'); setCenterModal(false); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const createLab = useMutation({
    mutationFn: api.createDiagnosticLaboratory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.diagnostics.labs() }); toast.success('Лаборатория создана'); setLabModal(false); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const updateLab = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.updateDiagnosticLaboratory(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.diagnostics.labs() }); toast.success('Лаборатория обновлена'); setLabModal(false); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const approveReg = useMutation({
    mutationFn: api.approveDiagnosticsRegistration,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['diagnostics', 'registrations'] }); toast.success('Заявка одобрена'); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const rejectReg = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.rejectDiagnosticsRegistration(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['diagnostics', 'registrations'] }); toast.success('Заявка отклонена'); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });
  const loadPricing = useMutation({
    mutationFn: api.getDiagnosticsCenterPricing,
    onSuccess: (data: any) => {
      const items = Array.isArray(data) ? data : [];
      setPricingItems(items.map((s: any) => ({ id: s.studyId || s.id || '', name: s.studyName || s.name || '', price: s.price || 0 })));
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка загрузки цен'),
  });
  const savePricing = useMutation({
    mutationFn: ({ centerId, studies }: { centerId: string; studies: { id: string; price: number }[] }) => api.updateDiagnosticsCenterPricing(centerId, studies),
    onSuccess: () => { toast.success('Цены обновлены'); setPricingModal(null); },
    onError: (e: any) => toast.error(e.message || 'Ошибка сохранения'),
  });
  const createCommission = useMutation({
    mutationFn: api.createDiagnosticsCommissionRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['diagnostics', 'commissionRules'] }); toast.success('Правило создано'); setCommissionForm({ centerId: '', labId: '', percentBps: '', description: '' }); },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  useEffect(() => {
    if (pricingModal) loadPricing.mutate(pricingModal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingModal]);

  const sData: any = stats.data || {};
  const centerList: any[] = Array.isArray(centers.data) ? centers.data : [];
  const labList: any[] = Array.isArray(labs.data) ? labs.data : [];
  const regList: any[] = Array.isArray(registrations.data) ? registrations.data : [];
  const commList: any[] = Array.isArray(commissionRules.data) ? commissionRules.data : [];

  const refData: any = referrals.data || {};
  const refList: any[] = Array.isArray(refData.data) ? refData.data : (Array.isArray(refData) ? refData : []);
  const refTotal: number = refData.total || refList.length;
  const refTotalPages = Math.max(1, Math.ceil(refTotal / REFERRAL_PAGE_SIZE));

  const filterBySearch = (list: any[], fields: string[]) =>
    list.filter(item => !search || fields.some(f => String(item[f] || '').toLowerCase().includes(search.toLowerCase())));

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['diagnostics'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnostics Management"
        subtitle="Управление диагностикой платформы"
        icon={<Microscope size={20} />}
        actions={
          <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={refreshAll}>Обновить</Button>
        }
      />

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setSearch(''); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${subTab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          {stats.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Всего направлений" value={sData.totalReferrals ?? sData.total ?? 0} icon={<FileCheck size={18} />} />
              <StatCard label="Сегодня" value={sData.todayReferrals ?? sData.today ?? 0} icon={<Clock size={18} />} />
              <StatCard label="Ожидают" value={sData.pendingReferrals ?? sData.pending ?? 0} icon={<AlertTriangle size={18} />} />
              <StatCard label="Завершены" value={sData.completedReferrals ?? sData.completed ?? 0} icon={<Check size={18} />} />
              <StatCard label="Центры" value={sData.totalCenters ?? centerList.length} icon={<Building2 size={18} />} />
              <StatCard label="Лаборатории" value={sData.totalLabs ?? labList.length} icon={<FlaskConical size={18} />} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><Building2 size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{centerList.length}</p>
                  <p className="text-xs text-txt-muted">Диагностических центров</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#3498DB]/10 text-[#3498DB]"><FlaskConical size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{labList.length}</p>
                  <p className="text-xs text-txt-muted">Лабораторий</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#22C55E]/10 text-[#22C55E]"><Users size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{regList.length}</p>
                  <p className="text-xs text-txt-muted">Заявок на регистрацию</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {subTab === 'referrals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={refSearch} onChange={e => { setRefSearch(e.target.value); setRefPage(1); }} placeholder="Поиск направлений..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
            </div>
            <Select value={refStatus} onChange={e => { setRefStatus(e.target.value); setRefPage(1); }} options={STATUS_OPTIONS} size="sm" className="w-auto min-w-[140px]" />
          </div>

          {referrals.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : refList.length === 0 ? (
            <EmptyState icon={<FileCheck size={40} />} title="Нет направлений" description="Направления появятся здесь после создания" />
          ) : (
            <>
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        {['Пациент', 'Центр', 'Исследование', 'Статус', 'Создано', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {refList.map((r: any) => (
                        <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-txt-primary">{r.patientName || r.patient?.name || '—'}</div>
                            <div className="text-xs text-txt-muted">{r.patientPhone || r.patient?.phone || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary">{r.centerName || r.center?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-txt-secondary">{r.studyName || r.study?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_BADGE[r.status] || 'default'} size="sm" dot>{STATUS_LABEL[r.status] || r.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-txt-muted">{fd(r.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Button size="icon-sm" variant="ghost" onClick={() => setRefDetail(r)} title="Подробнее"><Eye size={14} /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="flex justify-center">
                <Pagination page={refPage} totalPages={refTotalPages} onPageChange={setRefPage} />
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'centers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
              </div>
              <Button icon={<Plus size={16} />} onClick={() => { setEditCenter(null); setCenterForm({ name: '', city: '', phone: '', email: '', address: '' }); setCenterModal('create'); }}>Центр</Button>
            </div>
          </div>

          {centers.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <>
              {filterBySearch(centerList, ['name', 'city']).length === 0 ? (
                <EmptyState icon={<Building2 size={40} />} title="Нет центров" description="Добавьте диагностический центр" action={<Button icon={<Plus size={16} />} onClick={() => { setEditCenter(null); setCenterForm({ name: '', city: '', phone: '', email: '', address: '' }); setCenterModal('create'); }}>Добавить центр</Button>} />
              ) : (
                <Card padding="none">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-bdr-subtle">
                          {['Центр', 'Город', 'Контакты', 'Аккредитация', 'Действия'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filterBySearch(centerList, ['name', 'city']).map((c: any) => (
                          <tr key={c.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-txt-primary">{c.name}</div>
                              <div className="text-xs text-txt-muted">{c.address || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-txt-secondary">{c.city || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-txt-secondary">{c.phone || '—'}</div>
                              <div className="text-xs text-txt-muted">{c.email || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              {c.accredited ? <Badge variant="success" size="sm" dot>Аккредитован</Badge> : <Badge variant="default" size="sm">Нет</Badge>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button size="icon-sm" variant="ghost" onClick={() => { setEditCenter(c); setCenterForm({ name: c.name || '', city: c.city || '', phone: c.phone || '', email: c.email || '', address: c.address || '' }); setCenterModal('edit'); }} title="Редактировать"><Settings size={14} /></Button>
                                <Button size="icon-sm" variant="ghost" onClick={() => setPricingModal(c)} title="Цены"><DollarSign size={14} /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {subTab === 'labs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
              </div>
              <Button icon={<Plus size={16} />} onClick={() => { setEditLab(null); setLabForm({ name: '', city: '', phone: '', email: '' }); setLabModal('create'); }}>Лаборатория</Button>
            </div>
          </div>

          {labs.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <>
              {filterBySearch(labList, ['name', 'city']).length === 0 ? (
                <EmptyState icon={<FlaskConical size={40} />} title="Нет лабораторий" description="Добавьте лабораторию" action={<Button icon={<Plus size={16} />} onClick={() => { setEditLab(null); setLabForm({ name: '', city: '', phone: '', email: '' }); setLabModal('create'); }}>Добавить лабораторию</Button>} />
              ) : (
                <Card padding="none">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-bdr-subtle">
                          {['Лаборатория', 'Город', 'Контакты', 'Действия'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filterBySearch(labList, ['name', 'city']).map((l: any) => (
                          <tr key={l.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><FlaskConical size={14} /></div>
                                <div className="text-sm font-semibold text-txt-primary">{l.name}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-txt-secondary">{l.city || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-txt-secondary">{l.phone || '—'}</div>
                              <div className="text-xs text-txt-muted">{l.email || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <Button size="icon-sm" variant="ghost" onClick={() => { setEditLab(l); setLabForm({ name: l.name || '', city: l.city || '', phone: l.phone || '', email: l.email || '' }); setLabModal('edit'); }} title="Редактировать"><Settings size={14} /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {subTab === 'registrations' && (
        <div className="space-y-4">
          {registrations.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : regList.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="Нет заявок" description="Заявки на регистрацию появятся здесь" />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Название', 'Тип', 'Город', 'Контакты', 'Статус', 'Дата', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regList.map((r: any) => (
                      <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-txt-primary">{r.name}</div>
                          {r.comment && <div className="text-xs text-txt-muted mt-0.5 max-w-[200px] truncate">{r.comment}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={r.type === 'center' ? 'info' : 'gold'} size="sm">{r.type === 'center' ? 'Центр' : 'Лаборатория'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary">{r.city || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-txt-secondary">{r.phone || '—'}</div>
                          <div className="text-xs text-txt-muted">{r.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'error' : 'warning'}
                            size="sm" dot
                          >
                            {r.status === 'APPROVED' ? 'Одобрена' : r.status === 'REJECTED' ? 'Отклонена' : 'На рассмотрении'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          {r.status === 'PENDING' && (
                            <div className="flex gap-1">
                              <Button size="icon-sm" variant="success" onClick={() => approveReg.mutate(r.id)} title="Одобрить" loading={approveReg.isPending}><Check size={14} /></Button>
                              <Button size="icon-sm" variant="danger" onClick={() => rejectReg.mutate({ id: r.id })} title="Отклонить" loading={rejectReg.isPending}><X size={14} /></Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'commissions' && (
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-4">Новое правило комиссии</h3>
            <form onSubmit={e => {
              e.preventDefault();
              if (!commissionForm.percentBps || Number(commissionForm.percentBps) <= 0) { toast.warn('Укажите процент'); return; }
              if (!commissionForm.centerId && !commissionForm.labId) { toast.warn('Укажите центр или лабораторию'); return; }
              createCommission.mutate({
                centerId: commissionForm.centerId || undefined,
                labId: commissionForm.labId || undefined,
                percentBps: Math.round(Number(commissionForm.percentBps) * 100),
                description: commissionForm.description || undefined,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Select label="Центр" value={commissionForm.centerId} onChange={e => setCommissionForm({ ...commissionForm, centerId: e.target.value, labId: e.target.value ? '' : commissionForm.labId })}
                  options={[{ value: '', label: '—' }, ...centerList.map((c: any) => ({ value: c.id, label: c.name }))]} />
                <Select label="Лаборатория" value={commissionForm.labId} onChange={e => setCommissionForm({ ...commissionForm, labId: e.target.value })}
                  options={[{ value: '', label: '—' }, ...labList.map((l: any) => ({ value: l.id, label: l.name }))]} />
                <Input label="Процент (%)" type="number" step="0.01" min="0" max="100" value={commissionForm.percentBps} onChange={e => setCommissionForm({ ...commissionForm, percentBps: e.target.value })} placeholder="5.00" />
                <Input label="Описание" value={commissionForm.description} onChange={e => setCommissionForm({ ...commissionForm, description: e.target.value })} placeholder="Описание правила" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" icon={<Plus size={16} />} loading={createCommission.isPending}>Создать правило</Button>
              </div>
            </form>
          </Card>

          {commissionRules.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : commList.length === 0 ? (
            <EmptyState icon={<DollarSign size={40} />} title="Нет правил комиссий" description="Создайте первое правило комиссии выше" />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Центр / Лаборатория', 'Комиссия', 'Описание', 'Создано'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commList.map((rule: any) => {
                      const centerName = centerList.find((c: any) => c.id === rule.centerId)?.name;
                      const labName = labList.find((l: any) => l.id === rule.labId)?.name;
                      return (
                        <tr key={rule.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {rule.centerId && <Building2 size={14} className="text-txt-muted" />}
                              {rule.labId && <FlaskConical size={14} className="text-txt-muted" />}
                              <span className="text-sm text-txt-primary">{centerName || labName || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="gold" size="sm">{(rule.percentBps / 100).toFixed(2)}%</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary max-w-[240px] truncate">{rule.description || '—'}</td>
                          <td className="px-4 py-3 text-xs text-txt-muted">{fd(rule.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal open={!!centerModal} onClose={() => setCenterModal(false)} title={centerModal === 'edit' ? 'Редактировать центр' : 'Новый диагностический центр'}>
        <form onSubmit={e => {
          e.preventDefault();
          if (!centerForm.name.trim()) { toast.warn('Введите название'); return; }
          if (centerModal === 'edit' && editCenter) updateCenter.mutate({ id: editCenter.id, ...centerForm });
          else createCenter.mutate(centerForm);
        }} className="space-y-4">
          <Input label="Название *" value={centerForm.name} onChange={e => setCenterForm({ ...centerForm, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Город" value={centerForm.city} onChange={e => setCenterForm({ ...centerForm, city: e.target.value })} />
            <Input label="Телефон" value={centerForm.phone} onChange={e => setCenterForm({ ...centerForm, phone: e.target.value })} />
          </div>
          <Input label="Email" value={centerForm.email} onChange={e => setCenterForm({ ...centerForm, email: e.target.value })} type="email" />
          <Input label="Адрес" value={centerForm.address} onChange={e => setCenterForm({ ...centerForm, address: e.target.value })} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createCenter.isPending || updateCenter.isPending}>{centerModal === 'edit' ? 'Сохранить' : 'Создать центр'}</Button>
            <Button type="button" variant="ghost" onClick={() => setCenterModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!pricingModal} onClose={() => setPricingModal(null)} title={`Цены: ${pricingModal?.name || ''}`} size="lg">
        {loadPricing.isPending ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-txt-muted">Настройте цены на исследования для этого центра</p>
            {pricingItems.length === 0 ? (
              <p className="text-sm text-txt-muted text-center py-6">Нет исследований для настройки цен</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {pricingItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <span className="text-sm text-txt-primary flex-1 min-w-0 truncate">{item.name || `Исследование ${idx + 1}`}</span>
                    <div className="flex items-center gap-1">
                      <input type="number" value={item.price} min="0" step="100"
                        onChange={e => {
                          const updated = [...pricingItems];
                          updated[idx] = { ...updated[idx], price: Number(e.target.value) || 0 };
                          setPricingItems(updated);
                        }}
                        className="w-28 h-8 px-2 rounded-lg bg-white/[0.03] border border-bdr-subtle text-sm text-txt-primary text-right focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20" />
                      <span className="text-xs text-txt-muted">₸</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => {
                if (!pricingModal) return;
                savePricing.mutate({
                  centerId: pricingModal.id,
                  studies: pricingItems.map(i => ({ id: i.id, price: i.price })),
                });
              }} loading={savePricing.isPending} disabled={pricingItems.length === 0}>Сохранить цены</Button>
              <Button variant="ghost" onClick={() => setPricingModal(null)}>Отмена</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!labModal} onClose={() => setLabModal(false)} title={labModal === 'edit' ? 'Редактировать лабораторию' : 'Новая лаборатория'}>
        <form onSubmit={e => {
          e.preventDefault();
          if (!labForm.name.trim()) { toast.warn('Введите название'); return; }
          if (labModal === 'edit' && editLab) updateLab.mutate({ id: editLab.id, ...labForm });
          else createLab.mutate(labForm);
        }} className="space-y-4">
          <Input label="Название *" value={labForm.name} onChange={e => setLabForm({ ...labForm, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Город" value={labForm.city} onChange={e => setLabForm({ ...labForm, city: e.target.value })} />
            <Input label="Телефон" value={labForm.phone} onChange={e => setLabForm({ ...labForm, phone: e.target.value })} />
          </div>
          <Input label="Email" value={labForm.email} onChange={e => setLabForm({ ...labForm, email: e.target.value })} type="email" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createLab.isPending || updateLab.isPending}>{labModal === 'edit' ? 'Сохранить' : 'Создать лабораторию'}</Button>
            <Button type="button" variant="ghost" onClick={() => setLabModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!refDetail} onClose={() => setRefDetail(null)} title="Детали направления" size="lg">
        {refDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-txt-muted mb-1">Пациент</p>
                <p className="text-sm font-medium text-txt-primary">{refDetail.patientName || refDetail.patient?.name || '—'}</p>
                <p className="text-xs text-txt-muted">{refDetail.patientPhone || refDetail.patient?.phone || ''}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Центр</p>
                <p className="text-sm font-medium text-txt-primary">{refDetail.centerName || refDetail.center?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Исследование</p>
                <p className="text-sm font-medium text-txt-primary">{refDetail.studyName || refDetail.study?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Статус</p>
                <Badge variant={STATUS_BADGE[refDetail.status] || 'default'} size="md" dot>{STATUS_LABEL[refDetail.status] || refDetail.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Создано</p>
                <p className="text-sm text-txt-secondary">{fd(refDetail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Обновлено</p>
                <p className="text-sm text-txt-secondary">{fd(refDetail.updatedAt)}</p>
              </div>
            </div>
            {refDetail.clinicName && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Клиника</p>
                <p className="text-sm text-txt-secondary">{refDetail.clinicName}</p>
              </div>
            )}
            {refDetail.notes && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Примечания</p>
                <p className="text-sm text-txt-secondary">{refDetail.notes}</p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setRefDetail(null)}>Закрыть</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
