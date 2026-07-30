import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical, FileText, Clock, CheckCircle, XCircle, Search,
  PlayCircle, Activity, RefreshCw, Eye, DollarSign, Save, Building2,
} from 'lucide-react';
import { Tabs } from '@/components/ui/ds/Misc';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { queryKeys } from '@/queries/keys';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Отправлено', color: '#3498DB' },
  RECEIVED: { label: 'Получено', color: '#9B59B6' },
  ACCEPTED: { label: 'Принято', color: '#F39C12' },
  IN_PROGRESS: { label: 'В работе', color: '#C9A96E' },
  COMPLETED: { label: 'Завершено', color: '#27AE60' },
  REVIEWED: { label: 'Просмотрено', color: '#95A5A6' },
  CANCELLED: { label: 'Отменено', color: '#E74C3C' },
};

function LabReferralsTab({ labId }: { labId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costModal, setCostModal] = useState<string | null>(null);
  const [costValue, setCostValue] = useState('');
  const [feeValue, setFeeValue] = useState('');

  const { data: referralsData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ labId, status: statusFilter, search, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ labId, status: statusFilter, search, limit: '100' }),
    enabled: !!labId,
  });

  const referrals = referralsData?.items || referralsData?.data || referralsData?.referrals || [];
  const total = referralsData?.total || referrals.length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status, cost, platformFee }: { id: string; status: string; cost?: number; platformFee?: number }) =>
      api.changeDiagnosticReferralStatus(id, status, undefined, { cost, platformFee }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['diagnostics'] }); refetch(); setCostModal(null); },
  });

  const handleAccept = (id: string) => {
    const cost = parseFloat(costValue);
    const fee = parseFloat(feeValue);
    if (!cost || cost <= 0) return;
    statusMutation.mutate({ id, status: 'ACCEPTED', cost, platformFee: fee > 0 ? fee : undefined });
  };

  const stats = {
    total: referrals.length,
    sent: referrals.filter((r: any) => r.status === 'SENT').length,
    accepted: referrals.filter((r: any) => r.status === 'ACCEPTED').length,
    inProgress: referrals.filter((r: any) => r.status === 'IN_PROGRESS').length,
    completed: referrals.filter((r: any) => r.status === 'COMPLETED').length,
    cancelled: referrals.filter((r: any) => r.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Activity size={16} className="text-info" /><span className="text-xs text-txt-muted">Всего</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><FileText size={16} className="text-info" /><span className="text-xs text-txt-muted">Отправлено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{stats.sent}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Clock size={16} className="text-warning" /><span className="text-xs text-txt-muted">Принято</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{stats.accepted}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><PlayCircle size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">В работе</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{stats.inProgress}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /><span className="text-xs text-txt-muted">Завершено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{stats.completed}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-txt-muted" /><span className="text-xs text-txt-muted">Не оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{referrals.filter((r: any) => !r.paid && r.status === 'COMPLETED').length}</p>
        </GlassCard>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по пациенту..." className="w-full bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_MAP).map(([key, v]) => (<option key={key} value={key}>{v.label}</option>))}
        </select>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Обновить</Button>
      </div>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">Заказы ({total})</h3>
        {isLoading ? <Skeleton className="h-64" /> : referrals.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
            <FlaskConical size={32} className="opacity-20" />Нет заказов
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                  <th className="pb-2 pr-3">Пациент</th>
                  <th className="pb-2 pr-3">Исследование</th>
                  <th className="pb-2 pr-3">Клиника</th>
                  <th className="pb-2 pr-3">Стоимость</th>
                  <th className="pb-2 pr-3">Статус</th>
                  <th className="pb-2 pr-3">Дата</th>
                  <th className="pb-2 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => {
                  const statusInfo = STATUS_MAP[r.status] || { label: r.status, color: '#95A5A6' };
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <button onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} className="font-medium text-txt-primary hover:text-dv-gold transition-colors">{r.patientName || 'Неизвестно'}</button>
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.labTestType || r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.clinic?.name || r.clinicName || '—'}</td>
                      <td className="py-2.5 pr-3">
                        {r.cost ? (
                          <span className="text-txt-primary">{Number(r.cost).toLocaleString()} ₸</span>
                        ) : <span className="text-txt-ghost">—</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" style={{ borderColor: statusInfo.color, color: statusInfo.color }}>{statusInfo.label}</Badge>
                        {r.paid && <Badge variant="filled" className="ml-1 bg-success/20 text-success text-2xs">Оплачено</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1">
                          {r.status === 'SENT' && (
                            <Button size="xs" variant="primary" onClick={() => setCostModal(r.id)}>Принять</Button>
                          )}
                          {r.status === 'ACCEPTED' && (
                            <Button size="xs" variant="primary" onClick={() => statusMutation.mutate({ id: r.id, status: 'IN_PROGRESS' })}>Начать</Button>
                          )}
                          {r.status === 'IN_PROGRESS' && (
                            <Button size="xs" variant="primary" onClick={() => statusMutation.mutate({ id: r.id, status: 'COMPLETED', cost: Number(r.cost) || undefined })}>Завершить</Button>
                          )}
                          <Button size="xs" variant="ghost" icon={<Eye size={14} />} aria-label="View" onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {costModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCostModal(null)}>
          <Card padding="lg" className="max-w-sm w-full mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Принять заказ</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Стоимость услуги (₸)</label>
                <input type="number" value={costValue} onChange={(e) => setCostValue(e.target.value)} placeholder="Напр. 12000" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Комиссия платформы (₸, опционально)</label>
                <input type="number" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} placeholder="Напр. 1200" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setCostModal(null)}>Отмена</Button>
                <Button variant="primary" size="sm" onClick={() => handleAccept(costModal)} disabled={!costValue || parseFloat(costValue) <= 0}>Принять</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function LabServicesTab({ labId }: { labId: string }) {
  const queryClient = useQueryClient();

  const { data: testsData, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.labPricing(labId),
    queryFn: () => api.getDiagnosticsLabPricing(labId),
    enabled: !!labId,
  });

  const tests = Array.isArray(testsData?.data) ? testsData.data : [];
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tests.length > 0) {
      const initial: Record<string, string> = {};
      tests.forEach((s: any) => { initial[s.id] = String(s.price || ''); });
      setPrices((prev) => Object.keys(initial).some((k) => initial[k] !== prev[k]) ? initial : prev);
    }
  }, [tests]);

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; price: number }[]) => api.updateDiagnosticsLabPricing(labId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.labPricing(labId) }),
  });

  const handleSave = () => {
    const updates = Object.entries(prices)
      .filter(([, v]) => v !== '')
      .map(([id, price]) => ({ id, price: parseFloat(price) }));
    if (updates.length > 0) saveMutation.mutate(updates);
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-txt-primary">Прайс-лист анализов</h3>
        <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSave} loading={saveMutation.isPending}>Сохранить</Button>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                <th className="pb-2 pr-3">Анализ</th>
                <th className="pb-2 pr-3">Категория</th>
                <th className="pb-2 pr-3">Цена (₸)</th>
                <th className="pb-2 pr-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((s: any) => (
                <tr key={s.id} className="border-b border-bdr-subtle/50">
                  <td className="py-2.5 pr-3 font-medium text-txt-primary">{s.name}</td>
                  <td className="py-2.5 pr-3 text-txt-muted">{s.category}</td>
                  <td className="py-2.5 pr-3">
                    <input type="number" value={prices[s.id] ?? ''} onChange={(e) => setPrices((p: any) => ({ ...p, [s.id]: e.target.value }))} className="w-28 bg-surface-1 border border-bdr-subtle rounded-lg px-2 py-1 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                  </td>
                  <td className="py-2.5 pr-3"><Badge variant="outline" style={{ borderColor: s.active ? '#27AE60' : '#E74C3C', color: s.active ? '#27AE60' : '#E74C3C' }}>{s.active ? 'Активен' : 'Не активен'}</Badge></td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-txt-muted">Нет анализов. Добавьте их через панель администратора.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LabPaymentsTab({ labId }: { labId: string }) {
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.labPayments(labId),
    queryFn: () => api.getDiagnosticsLabPayments(labId),
    enabled: !!labId,
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const referrals = paymentsData?.data?.referrals || [];
  const totals = paymentsData?.data?.totals || { totalRevenue: 0, totalFees: 0, paidCount: 0, unpaidCount: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-success" /><span className="text-xs text-txt-muted">Выручка</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalRevenue).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Activity size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">Комиссия платформы</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalFees).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /><span className="text-xs text-txt-muted">Оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.paidCount}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Clock size={16} className="text-warning" /><span className="text-xs text-txt-muted">Ожидают оплаты</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.unpaidCount}</p>
        </GlassCard>
      </div>
      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">История оплат</h3>
        {referrals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет завершённых заказов</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                  <th className="pb-2 pr-3">Пациент</th>
                  <th className="pb-2 pr-3">Анализ</th>
                  <th className="pb-2 pr-3">Стоимость</th>
                  <th className="pb-2 pr-3">Комиссия</th>
                  <th className="pb-2 pr-3">К выплате</th>
                  <th className="pb-2 pr-3">Статус</th>
                  <th className="pb-2 pr-3">Дата</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => {
                  const net = Number(r.cost || 0) - Number(r.platformFee || 0);
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50">
                      <td className="py-2.5 pr-3 text-txt-primary">{r.patientName}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-primary">{Number(r.cost || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{Number(r.platformFee || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-success font-medium">{net.toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3">{r.paid ? <Badge variant="filled" className="bg-success/20 text-success">Оплачено</Badge> : <Badge variant="outline" className="text-warning border-warning">Ожидание</Badge>}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function LabDashboard() {
  const { user } = useAuth();
  const isOwnOrg = user?.organizationType === 'LABORATORY';
  const ownOrgId = user?.organizationId || '';
  const [labId, setLabId] = useState<string>(isOwnOrg ? ownOrgId : '');
  const [activeTab, setActiveTab] = useState('referrals');

  const { data: labsData } = useQuery({
    queryKey: queryKeys.diagnostics.labs(),
    queryFn: () => api.getDiagnosticLaboratories(),
    enabled: !isOwnOrg,
  });

  const labs = labsData?.data || labsData || [];

  useEffect(() => {
    if (isOwnOrg && ownOrgId) setLabId(ownOrgId);
  }, [isOwnOrg, ownOrgId]);

  const tabs = [
    { id: 'referrals', label: 'Заказы', icon: <FileText size={14} /> },
    { id: 'services', label: 'Анализы и цены', icon: <FlaskConical size={14} /> },
    { id: 'payments', label: 'Оплаты', icon: <DollarSign size={14} /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Панель лаборатории</h1>
          <p className="text-sm text-txt-muted mt-0.5">Управление заказами, анализами и оплатами</p>
        </div>
      </div>

      {!isOwnOrg && (
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-dv-gold shrink-0" />
            <select value={labId} onChange={(e) => setLabId(e.target.value)} className="flex-1 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
              <option value="">Выберите лабораторию</option>
              {labs.map((c: any) => (<option key={c.id} value={c.id}>{c.name} — {c.city || ''}</option>))}
            </select>
          </div>
        </Card>
      )}

      {labId && (
        <>
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          {activeTab === 'referrals' && <LabReferralsTab labId={labId} />}
          {activeTab === 'services' && <LabServicesTab labId={labId} />}
          {activeTab === 'payments' && <LabPaymentsTab labId={labId} />}
        </>
      )}
    </motion.div>
  );
}
