import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FlaskConical, PackageCheck, RefreshCw, Users, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Tabs } from '@/components/ui/ds/Misc';
import { getLabPlatformDashboard, getLabPlatformOrders, getLabPlatformTeam, updateLabPlatformOrderStatus, type LabPlatformOrder } from '@/utils/labPlatformApi';

const STAGES = [
  { id: 'pending', label: 'Новые' },
  { id: 'sent', label: 'Приняты' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'try_in', label: 'Примерка' },
  { id: 'adjustment', label: 'Коррекция' },
  { id: 'ready', label: 'Готово' },
  { id: 'delivered', label: 'Выдано' },
] as const;

const NEXT: Record<string, string[]> = {
  pending: ['sent'], sent: ['in_progress'], in_progress: ['try_in', 'adjustment', 'ready', 'remake', 'delayed'],
  try_in: ['adjustment', 'ready', 'remake'], adjustment: ['ready', 'remake'], ready: ['delivered', 'remake'],
  remake: ['in_progress'], delayed: ['in_progress'],
};

function Status({ status }: { status: string }) {
  const tone = status === 'ready' || status === 'delivered' ? 'success' : status === 'delayed' || status === 'remake' ? 'danger' : 'outline';
  const label = STAGES.find((s) => s.id === status)?.label || status;
  return <Badge variant={tone as any}>{label}</Badge>;
}

function OrderCard({ order, onStatus }: { order: LabPlatformOrder; onStatus: (id: string, status: string) => void }) {
  const next = NEXT[order.status] || [];
  const primary = next.find((s) => !['remake', 'delayed'].includes(s));
  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-txt-primary">{order.type || 'Лабораторная работа'}</p>
          <p className="mt-1 text-xs text-txt-muted">{order.patientName || 'Пациент'} · {order.clinicName || 'Клиника'}</p>
        </div>
        <Status status={order.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Зуб</span><div className="mt-1 font-medium">{order.toothNumber || '—'}</div></div>
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Материал</span><div className="mt-1 truncate font-medium">{order.material || '—'}</div></div>
      </div>
      {order.deadline && <div className="flex items-center gap-2 text-xs text-txt-muted"><Clock3 size={13} /> Дедлайн {new Date(order.deadline).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
      {primary && <Button size="sm" variant="secondary" className="w-full" onClick={() => onStatus(order.id, primary)}>{primary === 'delivered' ? 'Передать клинике' : 'Следующий этап'} <ArrowRight size={14} /></Button>}
    </Card>
  );
}

export default function DentalLabPlatform() {
  const [tab, setTab] = useState('board');
  const [filter, setFilter] = useState<string | undefined>();
  const qc = useQueryClient();
  const dashboard = useQuery({ queryKey: ['lab-platform', 'dashboard'], queryFn: getLabPlatformDashboard, refetchInterval: 30_000 });
  const orders = useQuery({ queryKey: ['lab-platform', 'orders', filter], queryFn: () => getLabPlatformOrders(filter), refetchInterval: 30_000 });
  const team = useQuery({ queryKey: ['lab-platform', 'team'], queryFn: getLabPlatformTeam, enabled: tab === 'team' });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateLabPlatformOrderStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); } });

  const grouped = useMemo(() => {
    const map: Record<string, LabPlatformOrder[]> = {};
    for (const stage of STAGES) map[stage.id] = [];
    for (const order of orders.data || []) (map[order.status] ||= []).push(order);
    return map;
  }, [orders.data]);

  if (dashboard.isLoading) return <div className="p-6"><Card padding="lg"><div className="h-32 animate-pulse rounded-xl bg-surface-2" /></Card></div>;
  if (dashboard.isError) return <div className="p-6"><QueryError what="кабинет лаборатории" onRetry={() => dashboard.refetch()} /></div>;

  const d = dashboard.data;
  const tabs = [
    { id: 'board', label: 'Производство', icon: <Wrench size={14} /> },
    { id: 'priority', label: 'Приоритет', icon: <AlertTriangle size={14} /> },
    { id: 'team', label: 'Команда', icon: <Users size={14} /> },
  ];

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      <PageHeader title={d.lab.name} subtitle="Dental Lab · производство, контроль качества и выдача" icon={<FlaskConical size={22} />} actions={<Button size="sm" variant="ghost" onClick={() => { dashboard.refetch(); orders.refetch(); }}><RefreshCw size={15} /> Обновить</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['В работе', d.totals.active, <Wrench size={18} />],
          ['До 48 часов', d.totals.dueSoon, <Clock3 size={18} />],
          ['Просрочено', d.totals.overdue, <AlertTriangle size={18} />],
          ['Готово', d.byStatus.ready || 0, <PackageCheck size={18} />],
        ].map(([label, value, icon]) => <Card key={String(label)} padding="md"><div className="flex items-center justify-between"><span className="text-xs text-txt-muted">{label}</span>{icon}</div><div className="mt-2 text-2xl font-semibold text-txt-primary">{String(value)}</div></Card>)}
      </div>

      <Card padding="md" className="border-dv-gold/20 bg-surface-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold">Контроль производства</p><p className="mt-1 text-xs text-txt-muted">Очередь синхронизирована с клиниками DentVision.</p></div>
          <div className="flex items-center gap-2 text-xs text-txt-muted"><CheckCircle2 size={15} /> {d.totals.all} заказов</div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'board' && <>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={!filter ? 'secondary' : 'ghost'} onClick={() => setFilter(undefined)}>Все</Button>
          {STAGES.slice(0, 6).map((stage) => <Button key={stage.id} size="sm" variant={filter === stage.id ? 'secondary' : 'ghost'} onClick={() => setFilter(stage.id)}>{stage.label} {d.byStatus[stage.id] || 0}</Button>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-6">
          {(filter ? [{ id: filter, label: STAGES.find((s) => s.id === filter)?.label || filter }] : STAGES.slice(0, 6)).map((stage) => (
            <section key={stage.id} className="min-w-0 space-y-3 rounded-2xl bg-surface-0/60 p-2">
              <div className="flex items-center justify-between px-1"><h3 className="text-xs font-semibold text-txt-secondary">{stage.label}</h3><Badge variant="outline">{grouped[stage.id]?.length || 0}</Badge></div>
              {(grouped[stage.id] || []).slice(0, 20).map((order) => <OrderCard key={order.id} order={order} onStatus={(id, status) => statusMutation.mutate({ id, status })} />)}
              {!grouped[stage.id]?.length && <div className="rounded-xl border border-dashed border-bdr-subtle p-5 text-center text-xs text-txt-muted">Нет работ</div>}
            </section>
          ))}
        </div>
      </>}

      {tab === 'priority' && <div className="grid gap-3 lg:grid-cols-2">{d.priority.map((order) => <OrderCard key={order.id} order={order} onStatus={(id, status) => statusMutation.mutate({ id, status })} />)}{!d.priority.length && <Card padding="lg"><p className="text-sm text-txt-muted">Критических работ сейчас нет.</p></Card>}</div>}

      {tab === 'team' && <Card padding="md"><div className="divide-y divide-bdr-subtle">{(team.data || []).map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{member.firstName} {member.lastName}</p><p className="text-xs text-txt-muted">{member.email}</p></div><Badge variant="outline">{member.role || 'Сотрудник'}</Badge></div>)}{!team.data?.length && <p className="py-6 text-center text-sm text-txt-muted">Команда пока не загружена.</p>}</div></Card>}
    </div>
  );
}
