import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FlaskConical, PackageCheck, RefreshCw, Truck, Users, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Tabs } from '@/components/ui/ds/Misc';
import { getLabPlatformDashboard, getLabPlatformOrders, getLabPlatformTeam, updateLabPlatformOrderStatus, updateLabPlatformQualityControl, updateLabPlatformRemakeRequest, createLabPlatformShipment, confirmLabPlatformDelivery, type LabPlatformOrder } from '@/utils/labPlatformApi';
import DentalLabServicesTab from './DentalLabServicesTab';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import EcosystemRelationRail from '@/components/ecosystem/EcosystemRelationRail';

const STAGES = [
  { id: 'pending', label: 'Новые' },
  { id: 'sent', label: 'Приняты' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'try_in', label: 'Примерка' },
  { id: 'adjustment', label: 'Коррекция' },
  { id: 'qc', label: 'Контроль качества' },
  { id: 'ready', label: 'Готово' },
  { id: 'delivered', label: 'Выдано' },
  { id: 'remake', label: 'Переделка' },
  { id: 'delayed', label: 'Задержано' },
] as const;

const NEXT: Record<string, string[]> = {
  pending: ['sent'], sent: ['in_progress'], in_progress: ['try_in', 'adjustment', 'qc', 'remake', 'delayed'],
  try_in: ['adjustment', 'qc', 'remake'], adjustment: ['qc', 'remake'], qc: [], ready: [],
  delivered: [], remake: ['in_progress'], delayed: ['in_progress'],
};

function Status({ status }: { status: string }) {
  const tone = status === 'ready' || status === 'delivered' ? 'success' : status === 'delayed' || status === 'remake' ? 'danger' : 'outline';
  const label = STAGES.find((s) => s.id === status)?.label || status;
  return <Badge variant={tone as any}>{label}</Badge>;
}

const QC_CHECKS = [
  { id: 'fit', label: 'Посадка и контакт' },
  { id: 'margins', label: 'Краевое прилегание' },
  { id: 'shade', label: 'Цвет и эстетика' },
  { id: 'occlusion', label: 'Окклюзия' },
  { id: 'surface', label: 'Поверхность и полировка' },
  { id: 'documentation', label: 'Комплектность и маркировка' },
] as const;

function QualityControlForm({ busy, onSubmit }: { busy: boolean; onSubmit: (checks: Record<string, boolean>, note: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const complete = QC_CHECKS.every((check) => values[check.id] === 'pass' || values[check.id] === 'fail');
  const passed = complete && QC_CHECKS.every((check) => values[check.id] === 'pass');
  const checks = Object.fromEntries(QC_CHECKS.map((check) => [check.id, values[check.id] === 'pass']));
  return (
    <div className="space-y-3 rounded-xl border border-dv-gold/30 bg-surface-2 p-3">
      <div><p className="text-xs font-semibold text-txt-primary">Контроль качества</p><p className="mt-1 text-[11px] text-txt-muted">Каждый пункт требует явной оценки.</p></div>
      <div className="space-y-2">
        {QC_CHECKS.map((check) => (
          <label key={check.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-txt-secondary">{check.label}</span>
            <select aria-label={check.label} value={values[check.id] || ''} onChange={(event) => setValues((current) => ({ ...current, [check.id]: event.target.value }))} className="max-w-[150px] rounded-lg border border-bdr-subtle bg-surface-1 px-2 py-1.5 text-xs">
              <option value="">Не проверено</option>
              <option value="pass">Соответствует</option>
              <option value="fail">Не соответствует</option>
            </select>
          </label>
        ))}
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} placeholder="Замечание обязательно при несоответствии" className="w-full rounded-lg border border-bdr-subtle bg-surface-1 p-2 text-xs text-txt-primary" />
      <Button size="sm" variant="primary" className="w-full" disabled={!complete || busy || (!passed && !note.trim())} onClick={() => onSubmit(checks, note)}>{passed ? 'Подтвердить QC' : 'Зафиксировать брак и отправить на переделку'}</Button>
    </div>
  );
}

function OrderCard({
  order, onStatus, onQc, onRemakeDecision, onDispatch, onConfirmDelivery,
  canManageQc, canManageShipping, qcBusy, remakeBusy, shipmentBusy, deliveryBusy,
}: {
  order: LabPlatformOrder;
  onStatus: (id: string, status: string) => void;
  onQc: (id: string, checks: Record<string, boolean>, note: string) => void;
  onRemakeDecision: (id: string, decision: 'accept' | 'reject', note: string) => void;
  onDispatch: (id: string, body: { method: 'COURIER' | 'PICKUP'; carrier?: string; trackingNumber?: string; trackingUrl?: string }) => void;
  onConfirmDelivery: (id: string, body: { proofUrl: string; recipientName: string; note?: string }) => void;
  canManageQc: boolean;
  canManageShipping: boolean;
  qcBusy: boolean;
  remakeBusy: boolean;
  shipmentBusy: boolean;
  deliveryBusy: boolean;
}) {
  const [responseNote, setResponseNote] = useState('');
  const [shipmentMethod, setShipmentMethod] = useState<'COURIER' | 'PICKUP'>('COURIER');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const next = NEXT[order.status] || [];
  const primary = next.find((s) => !['remake', 'delayed'].includes(s));
  const shipment = order.shipment;
  const shipmentLabel = shipment?.status === 'delivered' ? 'Вручено'
    : shipment?.status === 'ready_for_pickup' ? 'Ожидает самовывоза'
    : shipment?.status === 'dispatched' ? 'Передано перевозчику' : '';

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-txt-primary">{order.type || 'Лабораторная работа'}</p>
          <p className="mt-1 text-xs text-txt-muted">{order.patientName || 'Пациент'} · {order.clinicName || 'Клиника'}</p>
          {order.serviceName && <p className="mt-1 text-xs text-txt-secondary">{order.serviceName}{order.servicePriceSnapshot != null ? ` · ${Number(order.servicePriceSnapshot).toLocaleString('ru-RU')} ₸` : ''}</p>}
        </div>
        <Status status={order.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Зуб</span><div className="mt-1 font-medium">{order.toothNumber || '—'}</div></div>
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Материал</span><div className="mt-1 truncate font-medium">{order.material || '—'}</div></div>
      </div>
      {order.deadline && <div className="flex items-center gap-2 text-xs text-txt-muted"><Clock3 size={13} /> Дедлайн {new Date(order.deadline).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
      {order.remakeRequest?.status === 'requested' && <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3"><p className="text-xs font-semibold text-txt-primary">Клиника запросила переделку</p><p className="text-xs text-txt-secondary">{order.remakeRequest.reason}</p>{canManageQc ? <><textarea className="min-h-20 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-xs text-txt-primary" value={responseNote} onChange={event => setResponseNote(event.target.value)} maxLength={2000} placeholder="Комментарий лаборатории; при отклонении обязателен" /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={remakeBusy} onClick={() => onRemakeDecision(order.id, 'accept', responseNote)}>Принять переделку</Button><Button size="sm" variant="outline" disabled={remakeBusy || responseNote.trim().length < 5} onClick={() => onRemakeDecision(order.id, 'reject', responseNote)}>Отклонить запрос</Button></div></> : <p className="text-xs text-txt-muted">Ожидает решения владельца или менеджера лаборатории.</p>}</div>}
      {order.remakeRequest?.status === 'rejected' && <p className="rounded-lg bg-surface-2 p-2 text-xs text-txt-muted">Запрос переделки отклонён: {order.remakeRequest.responseNote || 'без комментария'}</p>}
      {order.status === 'qc' && (canManageQc ? <QualityControlForm busy={qcBusy} onSubmit={(checks, note) => onQc(order.id, checks, note)} /> : <p className="rounded-lg bg-surface-2 p-3 text-xs text-txt-muted">Ожидает подтверждения QC владельцем или менеджером лаборатории.</p>)}

      {order.status === 'ready' && !shipment && canManageShipping && (
        <div className="space-y-3 rounded-xl border border-bdr-subtle bg-surface-2 p-3">
          <div>
            <p className="text-xs font-semibold text-txt-primary">Оформить выдачу заказа</p>
            <p className="mt-1 text-[11px] text-txt-muted">Статус «Доставлено» появится только после подтверждения получателя.</p>
          </div>
          <label className="block space-y-1 text-xs text-txt-secondary">Способ передачи
            <select value={shipmentMethod} onChange={(event) => setShipmentMethod(event.target.value as 'COURIER' | 'PICKUP')} className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
              <option value="COURIER">Курьер / транспортная компания</option>
              <option value="PICKUP">Самовывоз из лаборатории</option>
            </select>
          </label>
          {shipmentMethod === 'COURIER' && <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-txt-secondary">Перевозчик
              <input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={100} placeholder="Название службы доставки" className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary">Трек-номер
              <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={120} placeholder="Номер отправления" className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
            </label>
            <label className="space-y-1 text-xs text-txt-secondary sm:col-span-2">Ссылка отслеживания (HTTPS)
              <input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} type="url" placeholder="https://..." className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
            </label>
          </div>}
          <Button size="sm" variant="primary" className="w-full" disabled={shipmentBusy || (shipmentMethod === 'COURIER' && (carrier.trim().length < 2 || trackingNumber.trim().length < 4))} onClick={() => onDispatch(order.id, { method: shipmentMethod, ...(shipmentMethod === 'COURIER' ? { carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}) } : {}) })}>
            {shipmentMethod === 'COURIER' ? 'Зарегистрировать отправку' : 'Подготовить к самовывозу'}
          </Button>
        </div>
      )}

      {shipment && (
        <div className="space-y-2 rounded-xl border border-bdr-subtle bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-txt-primary">Доставка и выдача</p>
            <Badge variant={shipment.status === 'delivered' ? 'success' : 'warning'}>{shipmentLabel}</Badge>
          </div>
          <div className="space-y-1 text-xs text-txt-secondary">
            <p>Способ: {shipment.method === 'PICKUP' ? 'Самовывоз' : 'Курьерская доставка'}</p>
            {shipment.carrier && <p>Перевозчик: {shipment.carrier}</p>}
            {shipment.trackingNumber && <p>Трек-номер: <span className="font-semibold text-txt-primary">{shipment.trackingNumber}</span></p>}
            {shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center text-accent underline">Отследить отправление</a>}
            {shipment.recipientName && <p>Получатель: {shipment.recipientName}</p>}
            {shipment.deliveredAt && <p>Вручено: {new Date(shipment.deliveredAt).toLocaleString('ru-RU')}</p>}
            {shipment.proofUrl && <a href={shipment.proofUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center text-accent underline">Открыть подтверждение вручения</a>}
          </div>
          {shipment.status !== 'delivered' && canManageShipping && (
            <div className="space-y-2 border-t border-bdr-subtle pt-3">
              <p className="text-xs font-semibold text-txt-primary">Подтвердить получение</p>
              <label className="block space-y-1 text-xs text-txt-secondary">HTTPS-ссылка на фото, накладную или акт
                <input type="url" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://..." className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
              </label>
              <label className="block space-y-1 text-xs text-txt-secondary">ФИО получателя
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} maxLength={120} className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
              </label>
              <textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={500} rows={2} placeholder="Комментарий (необязательно)" className="w-full rounded-lg border border-bdr-subtle bg-surface-1 p-2 text-xs text-txt-primary" />
              <Button size="sm" variant="primary" className="w-full" disabled={deliveryBusy || proofUrl.trim().length < 8 || recipientName.trim().length < 2} onClick={() => onConfirmDelivery(order.id, { proofUrl: proofUrl.trim(), recipientName: recipientName.trim(), ...(deliveryNote.trim() ? { note: deliveryNote.trim() } : {}) })}>Подтвердить вручение</Button>
            </div>
          )}
        </div>
      )}
      {primary && order.status !== 'qc' && <Button size="sm" variant="secondary" className="w-full" onClick={() => onStatus(order.id, primary)}>Следующий этап <ArrowRight size={14} /></Button>}
    </Card>
  );
}

export default function DentalLabPlatform() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const validTab = requestedTab === 'priority' || requestedTab === 'team' || requestedTab === 'services' || requestedTab === 'shipping' ? requestedTab : 'board';
  const [tab, setTab] = useState(validTab);
  const [filter, setFilter] = useState<string | undefined>();

  const changeTab = (nextTab: string) => {
    const selected = nextTab === 'priority' || nextTab === 'team' || nextTab === 'services' || nextTab === 'shipping' ? nextTab : 'board';
    setTab(selected);
    const nextParams = new URLSearchParams(searchParams);
    if (selected === 'board') nextParams.delete('tab');
    else nextParams.set('tab', selected);
    setSearchParams(nextParams, { replace: true });
  };
  const qc = useQueryClient();
  const context = useEcosystemUrlContext();
  const dashboard = useQuery({ queryKey: ['lab-platform', 'dashboard'], queryFn: getLabPlatformDashboard, refetchInterval: 30_000 });
  const orders = useQuery({ queryKey: ['lab-platform', 'orders', filter], queryFn: () => getLabPlatformOrders(filter), refetchInterval: 30_000 });
  const team = useQuery({ queryKey: ['lab-platform', 'team'], queryFn: getLabPlatformTeam, enabled: tab === 'team' });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateLabPlatformOrderStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); } });
  const qcMutation = useMutation({ mutationFn: ({ id, checks, note }: { id: string; checks: Record<string, boolean>; note: string }) => updateLabPlatformQualityControl(id, checks, note), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); } });
  const remakeMutation = useMutation({ mutationFn: ({ id, decision, note }: { id: string; decision: 'accept' | 'reject'; note: string }) => updateLabPlatformRemakeRequest(id, decision, note), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); } });
  const shipmentMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { method: 'COURIER' | 'PICKUP'; carrier?: string; trackingNumber?: string; trackingUrl?: string } }) => createLabPlatformShipment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); },
  });
  const deliveryMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { proofUrl: string; recipientName: string; note?: string } }) => confirmLabPlatformDelivery(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); },
  });
  const canManageQc = ['owner', 'admin', 'manager', 'director', 'lab_manager'].includes(String(dashboard.data?.membershipRole || '').toLowerCase());
  const memberRole = String(dashboard.data?.membershipRole || '').toLowerCase();
  const canManageShipping = canManageQc || ['courier', 'logistics', 'delivery_operator', 'dispatcher'].includes(memberRole);

  const grouped = useMemo(() => {
    const map: Record<string, LabPlatformOrder[]> = {};
    for (const stage of STAGES) map[stage.id] = [];
    for (const order of orders.data || []) (map[order.status] ||= []).push(order);
    return map;
  }, [orders.data]);

  if (dashboard.isLoading) return <div className="p-6"><Card padding="lg"><div className="h-32 animate-pulse rounded-xl bg-surface-2" /></Card></div>;
  if (dashboard.isError) return <div className="p-6"><QueryError what="кабинет лаборатории" onRetry={() => dashboard.refetch()} /></div>;
  const d = dashboard.data;
  if (!d) return <div className="p-6"><QueryError what="данные кабинета лаборатории" onRetry={() => dashboard.refetch()} /></div>;

  const tabs = [
    { id: 'board', label: 'Производство', icon: <Wrench size={14} /> },
    { id: 'priority', label: 'Приоритет', icon: <AlertTriangle size={14} /> },
    { id: 'team', label: 'Команда', icon: <Users size={14} /> },
    { id: 'shipping', label: 'Выдача и доставка', icon: <Truck size={14} /> },
    { id: 'services', label: 'Услуги и цены', icon: <PackageCheck size={14} /> },
  ];

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      {context.patientId || context.caseId ? <EcosystemRelationRail node="lab-order" title="Клинический контекст заказа" patientId={context.patientId} caseId={context.caseId} branchId={context.branchId} organizationId={context.organizationId} /> : null}
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
      <Tabs tabs={tabs} active={tab} onChange={changeTab} />
      {tab === 'board' && <>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={!filter ? 'secondary' : 'ghost'} onClick={() => setFilter(undefined)}>Все</Button>
          {STAGES.map((stage) => <Button key={stage.id} size="sm" variant={filter === stage.id ? 'secondary' : 'ghost'} onClick={() => setFilter(stage.id)}>{stage.label} {d.byStatus[stage.id] || 0}</Button>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-6">
          {(filter ? [{ id: filter, label: STAGES.find((s) => s.id === filter)?.label || filter }] : STAGES).map((stage) => (
            <section key={stage.id} className="min-w-0 space-y-3 rounded-2xl bg-surface-0/60 p-2">
              <div className="flex items-center justify-between px-1"><h3 className="text-xs font-semibold text-txt-secondary">{stage.label}</h3><Badge variant="outline">{grouped[stage.id]?.length || 0}</Badge></div>
              {(grouped[stage.id] || []).slice(0, 20).map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} canManageShipping={canManageShipping} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} shipmentBusy={shipmentMutation.isPending} deliveryBusy={deliveryMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} onDispatch={(id, body) => shipmentMutation.mutate({ id, body })} onConfirmDelivery={(id, body) => deliveryMutation.mutate({ id, body })} />)}
              {!grouped[stage.id]?.length && <div className="rounded-xl border border-dashed border-bdr-subtle p-5 text-center text-xs text-txt-muted">Нет работ</div>}
            </section>
          ))}
        </div>
      </>}
      {tab === 'priority' && <div className="grid gap-3 lg:grid-cols-2">{d.priority.map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} />)}{!d.priority.length && <Card padding="lg"><p className="text-sm text-txt-muted">Критических работ сейчас нет.</p></Card>}</div>}
      {tab === 'shipping' && <div className="grid gap-3 lg:grid-cols-2">
        {(orders.data || []).filter((order) => order.status === 'ready' || order.status === 'delivered').map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} canManageShipping={canManageShipping} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} shipmentBusy={shipmentMutation.isPending} deliveryBusy={deliveryMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} onDispatch={(id, body) => shipmentMutation.mutate({ id, body })} onConfirmDelivery={(id, body) => deliveryMutation.mutate({ id, body })} />)}
        {!(orders.data || []).some((order) => order.status === 'ready' || order.status === 'delivered') && <Card padding="lg"><p className="text-sm text-txt-muted">Нет заказов, ожидающих отправки, самовывоза или подтверждения вручения.</p></Card>}
      </div>}
      {tab === 'services' && <DentalLabServicesTab canManage={canManageQc} />}
      {tab === 'team' && <Card padding="md"><div className="divide-y divide-bdr-subtle">{(team.data || []).map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{member.firstName} {member.lastName}</p><p className="text-xs text-txt-muted">{member.email}</p></div><Badge variant="outline">{member.role || 'Сотрудник'}</Badge></div>)}{!team.data?.length && <p className="py-6 text-center text-sm text-txt-muted">Команда пока не загружена.</p>}</div></Card>}
    </div>
  );
}