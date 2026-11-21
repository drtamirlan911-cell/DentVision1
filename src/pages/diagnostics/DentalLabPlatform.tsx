import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, FlaskConical, History, PackageCheck, RefreshCw, Truck, Users, Wallet, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Tabs } from '@/components/ui/ds/Misc';
import { getLabPlatformDashboard, getLabPlatformFinance, getLabPlatformOrderLifecycle, getLabPlatformOrders, getLabPlatformTeam, assignLabTechnician, requestLabPlatformPayout, updateLabPlatformOrderStatus, updateLabPlatformQualityControl, updateLabPlatformRemakeRequest, createLabPlatformShipment, confirmLabPlatformDelivery, type LabPlatformOrder } from '@/utils/labPlatformApi';
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

function formatMinor(value: string | number | null | undefined): string {
  const amount = Number(value || 0) / 100;
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸`;
}

function payoutAmountToMinor(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}

function payoutStatusLabel(status: string): string {
  return ({ requested: 'На рассмотрении', approved: 'Одобрена', paid: 'Выплачена', rejected: 'Отклонена' } as Record<string, string>)[status] || status;
}

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
  order, onStatus, onQc, onRemakeDecision, onDispatch, onConfirmDelivery, onAssignTechnician,
  technicians, canManageQc, canManageShipping, canAssignTechnician, canViewDetails,
  qcBusy, remakeBusy, shipmentBusy, deliveryBusy, assignmentBusy,
}: {
  order: LabPlatformOrder;
  onStatus: (id: string, status: string) => void;
  onQc: (id: string, checks: Record<string, boolean>, note: string) => void;
  onRemakeDecision: (id: string, decision: 'accept' | 'reject', note: string) => void;
  onDispatch: (id: string, body: { method: 'COURIER' | 'PICKUP'; carrier?: string; trackingNumber?: string; trackingUrl?: string }) => void;
  onConfirmDelivery: (id: string, body: { proofUrl: string; recipientName: string; note?: string }) => void;
  onAssignTechnician: (id: string, technicianId: string | null) => void;
  technicians: Array<{ id: string; firstName: string; lastName: string; role?: string }>;
  canManageQc: boolean;
  canManageShipping: boolean;
  canAssignTechnician: boolean;
  canViewDetails: boolean;
  qcBusy: boolean;
  remakeBusy: boolean;
  shipmentBusy: boolean;
  deliveryBusy: boolean;
  assignmentBusy: boolean;
}) {
  const [responseNote, setResponseNote] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const timeline = useQuery({ queryKey: ['lab-platform', 'lifecycle', order.id], queryFn: () => getLabPlatformOrderLifecycle(order.id), enabled: showTimeline, staleTime: 15_000 });
  const [shipmentMethod, setShipmentMethod] = useState<'COURIER' | 'PICKUP'>('COURIER');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lifecycleQuery = useQuery({
    queryKey: ['lab-platform', 'lifecycle', order.id],
    queryFn: () => getLabPlatformOrderLifecycle(order.id),
    enabled: detailsOpen && canViewDetails,
  });
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
      {order.payment?.status === 'paid' && <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="success">Оплачено</Badge><span className="text-[11px] text-txt-muted">{new Date(order.payment.paidAt).toLocaleString('ru-RU')}</span></div>}
        </div>
        <Status status={order.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Зуб</span><div className="mt-1 font-medium">{order.toothNumber || '—'}</div></div>
        <div className="rounded-lg bg-surface-2 p-2"><span className="text-txt-muted">Материал</span><div className="mt-1 truncate font-medium">{order.material || '—'}</div></div>
      </div>
      {order.deadline && <div className="flex items-center gap-2 text-xs text-txt-muted"><Clock3 size={13} /> Дедлайн {new Date(order.deadline).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
      {canAssignTechnician && (
        <label className="block space-y-1 text-xs text-txt-secondary">Ответственный техник
          <select aria-label={`Ответственный техник для заказа ${order.id}`} value={order.technicianId || ''} disabled={assignmentBusy} onChange={(event) => onAssignTechnician(order.id, event.target.value || null)} className="min-h-10 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
            <option value="">Не назначен</option>
            {technicians.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName} · {member.role || 'техник'}</option>)}
          </select>
          {!technicians.length && <span className="text-[11px] text-txt-muted">Добавьте сотрудника с ролью техника, CAD-дизайнера или керамиста.</span>}
        </label>
      )}
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
      {canViewDetails && (
        <div className="border-t border-bdr-subtle pt-3">
          <Button size="sm" variant="ghost" className="w-full justify-between" onClick={() => setDetailsOpen((value) => !value)}>
            <span className="inline-flex items-center gap-2"><History size={14} /> История и детали</span>
            <span>{detailsOpen ? 'Скрыть' : 'Открыть'}</span>
          </Button>
          {detailsOpen && <div className="mt-3 space-y-3 rounded-lg bg-surface-2 p-3">
            {lifecycleQuery.isLoading && <p className="text-xs text-txt-muted">Загрузка хронологии заказа…</p>}
            {lifecycleQuery.isError && <QueryError what="историю заказа" onRetry={() => lifecycleQuery.refetch()} />}
            {lifecycleQuery.data && <>
              {lifecycleQuery.data.order.notes && <div><p className="text-[11px] font-semibold text-txt-muted">Техническое задание клиники</p><p className="mt-1 whitespace-pre-wrap text-xs text-txt-secondary">{lifecycleQuery.data.order.notes}</p></div>}
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-txt-primary"><Activity size={14} /> История производства</p>
                <div className="space-y-2">
                  {lifecycleQuery.data.events.map((event) => (
                    <div key={event.id} className="border-l-2 border-bdr-subtle pl-3">
                      <p className="text-xs font-medium text-txt-primary">{event.fromStatus ? STAGES.find((stage) => stage.id === event.fromStatus)?.label || event.fromStatus : 'Заказ передан'} → {STAGES.find((stage) => stage.id === event.toStatus)?.label || event.toStatus}</p>
                      {event.note && <p className="mt-1 text-xs text-txt-secondary">{event.note}</p>}
                      <p className="mt-1 text-[10px] text-txt-muted">{new Date(event.createdAt).toLocaleString('ru-RU')} · сотрудник {event.actorUserId.slice(0, 8)}</p>
                    </div>
                  ))}
                  {!lifecycleQuery.data.events.length && <p className="text-xs text-txt-muted">Событий пока нет.</p>}
                </div>
              </div>
              {!!lifecycleQuery.data.shipments.length && <div>
                <p className="mb-2 text-xs font-semibold text-txt-primary">Все отправки и выдачи</p>
                <div className="space-y-2">
                  {lifecycleQuery.data.shipments.map((item, index) => (
                    <div key={item.id} className="rounded-lg border border-bdr-subtle p-2">
                      <p className="text-xs font-medium text-txt-primary">Цикл {index + 1} · {item.method === 'PICKUP' ? 'Самовывоз' : 'Курьерская доставка'}</p>
                      <p className="mt-1 text-[11px] text-txt-muted">{item.status === 'delivered' ? 'Вручено' : item.status === 'ready_for_pickup' ? 'Ожидает самовывоза' : 'В пути'} · {new Date(item.dispatchedAt).toLocaleString('ru-RU')}</p>
                      {item.trackingNumber && <p className="mt-1 text-xs text-txt-secondary">Трек-номер: {item.trackingNumber}</p>}
                      {item.recipientName && <p className="text-xs text-txt-secondary">Получатель: {item.recipientName}</p>}
                      {item.proofUrl && <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">Доказательство вручения</a>}
                    </div>
                  ))}
                </div>
              </div>}
            </>}
          </div>}
        </div>
      )}
      <div className="border-t border-bdr-subtle pt-2">
        <Button size="sm" variant="ghost" className="w-full justify-between" onClick={() => setShowTimeline((value) => !value)}>
          <span className="inline-flex items-center gap-2"><History size={14} /> История заказа и отгрузок</span>
          <span>{showTimeline ? 'Скрыть' : 'Показать'}</span>
        </Button>
        {showTimeline && (
          <div className="mt-2 space-y-2">
            {timeline.isLoading && <p className="text-xs text-txt-muted">Загрузка истории…</p>}
            {timeline.isError && <QueryError what="историю производственного цикла" onRetry={() => timeline.refetch()} />}
            {timeline.data && (
              <>
                {[...timeline.data.events.map((event) => ({
                  id: event.id,
                  at: event.createdAt,
                  title: event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus,
                  note: event.note,
                })), ...timeline.data.shipmentEvents.map((event) => ({
                  id: event.id,
                  at: event.createdAt,
                  title: event.eventType,
                  note: event.note,
                }))].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).map((event) => (
                  <div key={event.id} className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-txt-primary">{event.title}</p>
                      <p className="text-[10px] text-txt-muted">{new Date(event.at).toLocaleString('ru-RU')}</p>
                    </div>
                    {event.note && <p className="mt-1 text-xs text-txt-secondary">{event.note}</p>}
                  </div>
                ))}
                {!timeline.data.events.length && !timeline.data.shipmentEvents.length && <p className="py-3 text-center text-xs text-txt-muted">История пока пуста.</p>}
                {timeline.data.shipments.length > 1 && <p className="text-[10px] text-txt-muted">Всего отправок: {timeline.data.shipments.length}, включая повторные отправки после переделки.</p>}
              </>
            )}
          </div>
        )}
      </div>
      {primary && order.status !== 'qc' && <Button size="sm" variant="secondary" className="w-full" onClick={() => onStatus(order.id, primary)}>Следующий этап <ArrowRight size={14} /></Button>}
    </Card>
  );
}

export default function DentalLabPlatform() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const validTab = requestedTab === 'priority' || requestedTab === 'team' || requestedTab === 'services' || requestedTab === 'shipping' || requestedTab === 'finance' ? requestedTab : 'board';
  const [tab, setTab] = useState(validTab);
  const [filter, setFilter] = useState<string | undefined>();

  const changeTab = (nextTab: string) => {
    const selected = nextTab === 'priority' || nextTab === 'team' || nextTab === 'services' || nextTab === 'shipping' || nextTab === 'finance' ? nextTab : 'board';
    setTab(selected);
    const nextParams = new URLSearchParams(searchParams);
    if (selected === 'board') nextParams.delete('tab');
    else nextParams.set('tab', selected);
    setSearchParams(nextParams, { replace: true });
  };
  const qc = useQueryClient();
  const context = useEcosystemUrlContext();
  const dashboard = useQuery({ queryKey: ['lab-platform', 'dashboard'], queryFn: getLabPlatformDashboard, refetchInterval: 30_000 });
  const memberRole = String(dashboard.data?.membershipRole || '').toLowerCase();
  const canManageQc = ['owner', 'admin', 'manager', 'director', 'lab_manager'].includes(memberRole);
  const canManageShipping = canManageQc || ['courier', 'logistics', 'delivery_operator', 'dispatcher'].includes(memberRole);
  const canManageFinance = canManageQc || ['lab_finance', 'finance', 'accountant'].includes(memberRole);
  const canReadProduction = canManageQc || ['technician', 'dental_technician', 'lab_technician', 'cad_designer', 'ceramist', 'orthodontic_technician'].includes(memberRole);
  const canReadOrders = canReadProduction || ['courier', 'logistics', 'delivery_operator', 'dispatcher'].includes(memberRole);
  const effectiveTab = !canReadProduction && tab === 'board' && canManageFinance ? 'finance'
    : !canReadProduction && tab === 'board' && canManageShipping ? 'shipping'
    : (tab === 'finance' && !canManageFinance)
      || (['team', 'services'].includes(tab) && !canManageQc)
      || (tab === 'shipping' && !canManageShipping)
      || (['board', 'priority'].includes(tab) && !canReadProduction) ? 'board' : tab;
  const orders = useQuery({ queryKey: ['lab-platform', 'orders', filter], queryFn: () => getLabPlatformOrders(filter), enabled: canReadOrders, refetchInterval: 30_000 });
  const team = useQuery({ queryKey: ['lab-platform', 'team'], queryFn: getLabPlatformTeam, enabled: canManageQc && (effectiveTab === 'team' || ['board', 'priority'].includes(effectiveTab)) });
  const finance = useQuery({ queryKey: ['lab-platform', 'finance'], queryFn: getLabPlatformFinance, enabled: effectiveTab === 'finance' && canManageFinance, refetchInterval: 30_000 });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateLabPlatformOrderStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); } });
  const technicianMutation = useMutation({
    mutationFn: ({ id, technicianId }: { id: string; technicianId: string | null }) => assignLabTechnician(id, technicianId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lab-platform'] }); },
  });
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
  const technicians = (team.data || []).filter((member) => ['technician', 'dental_technician', 'lab_technician', 'cad_designer', 'ceramist', 'orthodontic_technician'].includes(String(member.role || '').toLowerCase()));
  const [payoutAmount, setPayoutAmount] = useState('');
  const payoutAmountMinor = payoutAmountToMinor(payoutAmount);
  const payoutMutation = useMutation({
    mutationFn: () => requestLabPlatformPayout(payoutAmount.trim()),
    onSuccess: () => {
      setPayoutAmount('');
      qc.invalidateQueries({ queryKey: ['lab-platform', 'finance'] });
    },
  });

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
    ...(canReadProduction ? [
      { id: 'board', label: 'Производство', icon: <Wrench size={14} /> },
      { id: 'priority', label: 'Приоритет', icon: <AlertTriangle size={14} /> },
    ] : []),
    ...(canManageQc ? [
      { id: 'team', label: 'Команда', icon: <Users size={14} /> },
      { id: 'services', label: 'Услуги и цены', icon: <PackageCheck size={14} /> },
    ] : []),
    ...(canManageShipping ? [{ id: 'shipping', label: 'Выдача и доставка', icon: <Truck size={14} /> }] : []),
    ...(canManageFinance ? [{ id: 'finance', label: 'Финансы', icon: <Wallet size={14} /> }] : []),
  ];

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      {context.patientId || context.caseId ? <EcosystemRelationRail node="lab-order" title="Клинический контекст заказа" patientId={context.patientId} caseId={context.caseId} branchId={context.branchId} organizationId={context.organizationId} /> : null}
      <PageHeader title={d.lab.name} subtitle="Dental Lab · производство, контроль качества и выдача" icon={<FlaskConical size={22} />} actions={<Button size="sm" variant="ghost" onClick={() => { dashboard.refetch(); if (canReadOrders) orders.refetch(); if (effectiveTab === 'finance' && canManageFinance) finance.refetch(); }}><RefreshCw size={15} /> Обновить</Button>} />
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
      <Tabs tabs={tabs} active={effectiveTab} onChange={changeTab} />
      {effectiveTab === 'board' && <>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={!filter ? 'secondary' : 'ghost'} onClick={() => setFilter(undefined)}>Все</Button>
          {STAGES.map((stage) => <Button key={stage.id} size="sm" variant={filter === stage.id ? 'secondary' : 'ghost'} onClick={() => setFilter(stage.id)}>{stage.label} {d.byStatus[stage.id] || 0}</Button>)}
        </div>
        <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-6">
          {(filter ? [{ id: filter, label: STAGES.find((s) => s.id === filter)?.label || filter }] : STAGES).map((stage) => (
            <section key={stage.id} className="min-w-0 space-y-3 rounded-2xl bg-surface-0/60 p-2">
              <div className="flex items-center justify-between px-1"><h3 className="text-xs font-semibold text-txt-secondary">{stage.label}</h3><Badge variant="outline">{grouped[stage.id]?.length || 0}</Badge></div>
              {(grouped[stage.id] || []).slice(0, 20).map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} canManageShipping={canManageShipping} canAssignTechnician={canManageQc} canViewDetails={canManageQc || canReadProduction} technicians={technicians} assignmentBusy={technicianMutation.isPending} onAssignTechnician={(id, technicianId) => technicianMutation.mutate({ id, technicianId })} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} shipmentBusy={shipmentMutation.isPending} deliveryBusy={deliveryMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} onDispatch={(id, body) => shipmentMutation.mutate({ id, body })} onConfirmDelivery={(id, body) => deliveryMutation.mutate({ id, body })} />)}
              {!grouped[stage.id]?.length && <div className="rounded-xl border border-dashed border-bdr-subtle p-5 text-center text-xs text-txt-muted">Нет работ</div>}
            </section>
          ))}
        </div>
      </>}
      {effectiveTab === 'priority' && <div className="grid gap-3 lg:grid-cols-2">{d.priority.map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} canManageShipping={canManageShipping} canAssignTechnician={canManageQc} canViewDetails={canManageQc || canReadProduction} technicians={technicians} assignmentBusy={technicianMutation.isPending} onAssignTechnician={(id, technicianId) => technicianMutation.mutate({ id, technicianId })} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} shipmentBusy={shipmentMutation.isPending} deliveryBusy={deliveryMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} onDispatch={(id, body) => shipmentMutation.mutate({ id, body })} onConfirmDelivery={(id, body) => deliveryMutation.mutate({ id, body })} />)}{!d.priority.length && <Card padding="lg"><p className="text-sm text-txt-muted">Критических работ сейчас нет.</p></Card>}</div>}
      {effectiveTab === 'shipping' && <div className="grid gap-3 lg:grid-cols-2">
        {(orders.data || []).filter((order) => order.status === 'ready' || order.status === 'delivered').map((order) => <OrderCard key={order.id} order={order} canManageQc={canManageQc} canManageShipping={canManageShipping} canAssignTechnician={canManageQc} canViewDetails={canManageQc || canReadProduction} technicians={technicians} assignmentBusy={technicianMutation.isPending} onAssignTechnician={(id, technicianId) => technicianMutation.mutate({ id, technicianId })} qcBusy={qcMutation.isPending} remakeBusy={remakeMutation.isPending} shipmentBusy={shipmentMutation.isPending} deliveryBusy={deliveryMutation.isPending} onQc={(id, checks, note) => qcMutation.mutate({ id, checks, note })} onRemakeDecision={(id, decision, note) => remakeMutation.mutate({ id, decision, note })} onStatus={(id, status) => statusMutation.mutate({ id, status })} onDispatch={(id, body) => shipmentMutation.mutate({ id, body })} onConfirmDelivery={(id, body) => deliveryMutation.mutate({ id, body })} />)}
        {!(orders.data || []).some((order) => order.status === 'ready' || order.status === 'delivered') && <Card padding="lg"><p className="text-sm text-txt-muted">Нет заказов, ожидающих отправки, самовывоза или подтверждения вручения.</p></Card>}
      </div>}
      {effectiveTab === 'services' && <DentalLabServicesTab canManage={canManageQc} />}
      {effectiveTab === 'team' && <Card padding="md"><div className="divide-y divide-bdr-subtle">{(team.data || []).map((member) => <div key={member.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{member.firstName} {member.lastName}</p><p className="text-xs text-txt-muted">{member.email}</p></div><Badge variant="outline">{member.role || 'Сотрудник'}</Badge></div>)}{!team.data?.length && <p className="py-6 text-center text-sm text-txt-muted">Команда пока не загружена.</p>}</div></Card>}
      {effectiveTab === 'finance' && (!canManageFinance
        ? <Card padding="lg"><p className="text-sm text-txt-muted">Финансовый раздел доступен владельцу, менеджеру или назначенному сотруднику финслужбы.</p></Card>
        : finance.isLoading
          ? <Card padding="lg"><div className="h-28 animate-pulse rounded-xl bg-surface-2" /></Card>
          : finance.isError
            ? <QueryError what="финансы лаборатории" onRetry={() => finance.refetch()} />
            : finance.data && <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card padding="md"><p className="text-xs text-txt-muted">Баланс партнёра</p><p className="mt-2 text-xl font-semibold text-txt-primary">{formatMinor(finance.data.wallet.balance)}</p></Card>
                <Card padding="md"><p className="text-xs text-txt-muted">Доступно к выплате</p><p className="mt-2 text-xl font-semibold text-txt-primary">{formatMinor(finance.data.availableBalanceMinor)}</p></Card>
                <Card padding="md"><p className="text-xs text-txt-muted">Оплаченный оборот</p><p className="mt-2 text-xl font-semibold text-txt-primary">{formatMinor(finance.data.economics.totals.grossMinor)}</p></Card>
                <Card padding="md"><p className="text-xs text-txt-muted">Комиссия DentVision</p><p className="mt-2 text-xl font-semibold text-txt-primary">{formatMinor(finance.data.economics.totals.commissionMinor)}</p></Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <Card padding="md" className="space-y-3">
                  <div><h3 className="text-sm font-semibold text-txt-primary">Запрос выплаты</h3><p className="mt-1 text-xs text-txt-muted">Сумма резервируется на время рассмотрения. Проводка выполняется только после статуса «Выплачена».</p></div>
                  <label className="block space-y-1 text-xs text-txt-secondary">Сумма, ₸
                    <input type="number" min="0.01" step="0.01" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} placeholder="Например, 50000" className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
                  </label>
                  {payoutMutation.isError && <p className="text-xs text-error">{payoutMutation.error instanceof Error ? payoutMutation.error.message : 'Не удалось создать заявку'}</p>}
                  <Button size="sm" className="w-full" loading={payoutMutation.isPending} disabled={payoutMutation.isPending || payoutAmountMinor === null || payoutAmountMinor <= 0n || payoutAmountMinor > BigInt(finance.data.availableBalanceMinor)} onClick={() => payoutMutation.mutate()}>Запросить выплату</Button>
                </Card>
                <Card padding="md" className="space-y-3">
                  <h3 className="text-sm font-semibold text-txt-primary">Заявки на выплату</h3>
                  <div className="divide-y divide-bdr-subtle">
                    {finance.data.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between gap-3 py-3">
                      <div><p className="text-sm font-medium text-txt-primary">{formatMinor(payout.amount)}</p><p className="text-xs text-txt-muted">{new Date(payout.createdAt).toLocaleString('ru-RU')}</p></div>
                      <Badge variant={payout.status === 'paid' ? 'success' : payout.status === 'rejected' ? 'error' : 'outline'}>{payoutStatusLabel(payout.status)}</Badge>
                    </div>)}
                    {!finance.data.payouts.length && <p className="py-5 text-center text-xs text-txt-muted">Заявок на выплату пока нет.</p>}
                  </div>
                </Card>
              </div>
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-txt-primary">Расчёты по заказам</h3><Badge variant="outline">{finance.data.economics.totals.operations} оплат</Badge></div>
                {finance.data.economics.rows.length ? <div className="divide-y divide-bdr-subtle">
                  {finance.data.economics.rows.slice(0, 12).map((row) => <div key={row.transactionId} className="grid grid-cols-2 gap-2 py-3 text-xs sm:grid-cols-4">
                    <div><p className="text-txt-muted">Заказ</p><p className="mt-1 truncate font-medium text-txt-primary">{row.operationId.slice(0, 12)}</p></div>
                    <div><p className="text-txt-muted">Оплачено</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.grossMinor)}</p></div>
                    <div><p className="text-txt-muted">Комиссия</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.commissionMinor)}</p></div>
                    <div><p className="text-txt-muted">Доля лаборатории</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.partnerPayoutMinor)}</p></div>
                  </div>)}
                </div> : <p className="py-5 text-center text-xs text-txt-muted">Оплаченных заказов пока нет. Начисления появятся после успешного расчёта.</p>}
                {finance.data.economics.discrepancies > 0 && <p className="text-xs text-error">Обнаружены расхождения в финансовых записях: {finance.data.economics.discrepancies}.</p>}
              </Card>
            </div>)}

    </div>
  );
}