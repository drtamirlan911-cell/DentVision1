import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatCard, PageHeader, GlassCard, Card, CardContent, Button, Badge, Modal, Input, Select, EmptyState, Skeleton } from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import * as api from '../../utils/api';
import { Activity, Building2, Users, ShoppingCart, GraduationCap, AlertTriangle, Check, X, RefreshCw, Zap, Settings, Shield, Clock, Power, PowerOff, Calendar, TrendingUp, DollarSign } from 'lucide-react';

const fd = (d: string) => new Date(d).toLocaleDateString('ru-RU');
const fmtKzt = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₸';

export default function OpsTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<'overview' | 'clinics' | 'automations'>('overview');
  const [extendModal, setExtendModal] = useState<any>(null);
  const [extendMonths, setExtendMonths] = useState(3);
  const [planModal, setPlanModal] = useState<any>(null);
  const [newPlan, setNewPlan] = useState('professional');

  const overview = useQuery({
    queryKey: ['ops', 'overview'],
    queryFn: () => api.opsOverview(),
    staleTime: 30_000,
  });

  const clinics = useQuery({
    queryKey: ['ops', 'clinics'],
    queryFn: () => api.opsListClinics(),
    staleTime: 30_000,
  });

  const changePlan = useMutation({
    mutationFn: (data: { id: string; plan: string }) =>
      api.opsClinicPlan(data.id, data.plan),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast('Тариф изменён', 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const extendSub = useMutation({
    mutationFn: (data: { id: string; months: number }) =>
      api.opsClinicExtend(data.id, data.months),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops'] }); setExtendModal(null); toast.showToast('Подписка продлена', 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const suspendClinic = useMutation({
    mutationFn: (id: string) => api.opsClinicSuspend(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast('Клиника заморожена', 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const activateClinic = useMutation({
    mutationFn: (id: string) => api.opsClinicActivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast('Клиника активирована', 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const advanceSuppliers = useMutation({
    mutationFn: () => api.opsAutoAdvanceSuppliers(),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast(`Продвинуто заявок: ${(d as any)?.advanced || 0}`, 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const verifyLecturers = useMutation({
    mutationFn: () => api.opsAutoVerifyLecturers(),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast(`Верифицировано лекторов: ${(d as any)?.verified || 0}`, 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const extendExpiring = useMutation({
    mutationFn: () => api.opsAutoExtendClinics(),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['ops'] }); toast.showToast(`Продлено подписок: ${(d as any)?.extended || 0}`, 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const ov = overview.data?.data;
  const clinicList = clinics.data?.data || [];
  const loading = overview.isLoading || clinics.isLoading;

  const planColors: Record<string, string> = { starter: 'bg-gray-500/20 text-gray-400', professional: 'bg-blue-500/20 text-blue-400', enterprise: 'bg-yellow-500/20 text-yellow-400' };

  const tabs = [
    { id: 'overview' as const, label: 'Обзор' },
    { id: 'clinics' as const, label: 'Клиники' },
    { id: 'automations' as const, label: 'Автоматизации' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={<Shield size={20} className="text-dv-gold" />} title="Ops Command Center" subtitle="Управление платформой и автоматизации" />

      <div className="flex gap-2 border-b border-bdr-subtle pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${subTab === t.id ? 'bg-surface-1 text-txt-primary' : 'text-txt-muted hover:text-txt-secondary'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          {subTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard icon={<Building2 size={18} />} label="Клиники" value={ov?.totalClinics ?? clinicList.length} />
                <StatCard icon={<Users size={18} />} label="Пользователи" value={ov?.totalUsers ?? 0} />
                <StatCard icon={<Users size={18} />} label="Пациенты" value={ov?.totalPatients ?? 0} />
                <StatCard icon={<ShoppingCart size={18} />} label="Поставщики" value={ov?.totalSuppliers ?? 0} />
                <StatCard icon={<DollarSign size={18} />} label="MRR" value={fmtKzt(ov?.mrr ?? 0)} />
                <StatCard icon={<TrendingUp size={18} />} label="Revenue" value={fmtKzt(ov?.platformRevenue ?? 0)} />
              </div>

              {ov?.queues && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ov.queues.pendingSuppliers > 0 && (
                    <GlassCard padding="md" className="border border-yellow-500/20">
                      <div className="flex items-center gap-2 mb-1"><ShoppingCart size={16} className="text-yellow-400" /><span className="text-sm font-semibold text-txt-primary">Ожидают поставщики</span></div>
                      <p className="text-2xl font-bold text-yellow-400">{ov.queues.pendingSuppliers}</p>
                    </GlassCard>
                  )}
                  {ov.queues.newLecturers > 0 && (
                    <GlassCard padding="md" className="border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-1"><GraduationCap size={16} className="text-blue-400" /><span className="text-sm font-semibold text-txt-primary">Новые лекторы</span></div>
                      <p className="text-2xl font-bold text-blue-400">{ov.queues.newLecturers}</p>
                    </GlassCard>
                  )}
                  {ov.queues.expiringSubscriptions > 0 && (
                    <GlassCard padding="md" className="border border-red-500/20">
                      <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-red-400" /><span className="text-sm font-semibold text-txt-primary">Истекающие подписки</span></div>
                      <p className="text-2xl font-bold text-red-400">{ov.queues.expiringSubscriptions}</p>
                    </GlassCard>
                  )}
                </div>
              )}
            </div>
          )}

          {subTab === 'clinics' && (
            <div className="space-y-4">
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        {['Клиника', 'Город', 'Тариф', 'Подписка', 'Участники', 'Действия'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clinicList.map((c: any) => (
                        <tr key={c.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-txt-primary">{c.name}</div>
                            <div className="text-xs text-txt-muted">{c.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary">{c.city || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge className={planColors[c.subscription?.plan || 'starter'] || planColors.starter}>{c.subscription?.plan || 'starter'}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {c.subscription?.periodEnd ? (
                              <div>
                                <div className="text-sm text-txt-secondary">{fd(c.subscription.periodEnd)}</div>
                                <div className="text-xs text-txt-muted">{c.subscription.status}</div>
                              </div>
                            ) : <span className="text-xs text-txt-muted">Нет</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary">{c.memberCount ?? c._count?.members ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button size="icon-sm" variant="ghost" title="Изменить тариф" onClick={() => { setPlanModal(c); setNewPlan(c.subscription?.plan || 'starter'); }}><Settings size={14} /></Button>
                              <Button size="icon-sm" variant="ghost" title="Продлить" onClick={() => { setExtendModal(c); setExtendMonths(3); }}><Calendar size={14} /></Button>
                              {c.subscription?.status === 'suspended' ? (
                                <Button size="icon-sm" variant="ghost" title="Активировать" onClick={() => activateClinic.mutate(c.id)} className="text-green-400 hover:text-green-300"><Power size={14} /></Button>
                              ) : (
                                <Button size="icon-sm" variant="ghost" title="Заморозить" onClick={() => { if (confirm(`Заморозить ${c.name}?`)) suspendClinic.mutate(c.id); }} className="text-red-400 hover:text-red-300"><PowerOff size={14} /></Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {clinicList.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-12"><EmptyState icon={<Building2 size={40} />} title="Нет клиник" description="Клиники пока не зарегистрированы" /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {subTab === 'automations' && (
            <div className="space-y-4">
              <GlassCard padding="md">
                <div className="flex items-center gap-3 mb-2"><Zap size={20} className="text-dv-gold" /><h3 className="text-sm font-semibold text-txt-primary">Пакетные автоматизации</h3></div>
                <p className="text-xs text-txt-muted mb-4">Автоматические действия над очередями заявок и подписками.</p>
              </GlassCard>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md">
                  <div className="flex items-center gap-2 mb-3"><ShoppingCart size={16} className="text-yellow-400" /><h4 className="text-sm font-semibold text-txt-primary">Поставщики</h4></div>
                  <p className="text-xs text-txt-muted mb-4">Продвинуть всех поставников из pending в documents_review</p>
                  <Button size="sm" onClick={() => advanceSuppliers.mutate()} loading={advanceSuppliers.isPending}>
                    <RefreshCw size={14} className="mr-1" /> Продвинуть заявки
                  </Button>
                </Card>

                <Card padding="md">
                  <div className="flex items-center gap-2 mb-3"><GraduationCap size={16} className="text-blue-400" /><h4 className="text-sm font-semibold text-txt-primary">Лекторы</h4></div>
                  <p className="text-xs text-txt-muted mb-4">Верифицировать новых лекторов с документами</p>
                  <Button size="sm" onClick={() => verifyLecturers.mutate()} loading={verifyLecturers.isPending}>
                    <Check size={14} className="mr-1" /> Верифицировать
                  </Button>
                </Card>

                <Card padding="md">
                  <div className="flex items-center gap-2 mb-3"><Clock size={16} className="text-red-400" /><h4 className="text-sm font-semibold text-txt-primary">Подписки</h4></div>
                  <p className="text-xs text-txt-muted mb-4">Продлить подписки, истекающие в течение 14 дней</p>
                  <Button size="sm" onClick={() => extendExpiring.mutate()} loading={extendExpiring.isPending}>
                    <RefreshCw size={14} className="mr-1" /> Продлить истекающие
                  </Button>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!planModal} onClose={() => setPlanModal(null)} title={`Тариф: ${planModal?.name || ''}`}>
        <div className="space-y-4">
          <Select label="Новый тариф" value={newPlan} onChange={e => setNewPlan(e.target.value)} options={[{ value: 'starter', label: 'Starter (Бесплатно)' }, { value: 'professional', label: 'Professional (49 900 ₸/мес)' }, { value: 'enterprise', label: 'Enterprise (149 900 ₸/мес)' }]} />
          <div className="flex gap-2">
            <Button onClick={() => { if (planModal) changePlan.mutate({ id: planModal.id, plan: newPlan }); }} loading={changePlan.isPending}>Применить</Button>
            <Button variant="ghost" onClick={() => setPlanModal(null)}>Отмена</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!extendModal} onClose={() => setExtendModal(null)} title={`Продление: ${extendModal?.name || ''}`}>
        <div className="space-y-4">
          <Select label="Месяцев" value={String(extendMonths)} onChange={e => setExtendMonths(Number(e.target.value))} options={[1, 2, 3, 6, 12].map(m => ({ value: String(m), label: `${m} мес.` }))} />
          <div className="flex gap-2">
            <Button onClick={() => { if (extendModal) extendSub.mutate({ id: extendModal.id, months: extendMonths }); }} loading={extendSub.isPending}>Продлить</Button>
            <Button variant="ghost" onClick={() => setExtendModal(null)}>Отмена</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
