import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, ClipboardList, PackagePlus, RotateCcw, Scissors } from 'lucide-react';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useToast } from '@/components/ui/ds/Toast';
import {
  consumeDentalLabOrderMaterial,
  createDentalLabMaterial,
  getDentalLabMaterials,
  getDentalLabOrderMaterialConsumptions,
  getLabPlatformOrders,
  receiveDentalLabMaterialLot,
  reverseDentalLabOrderMaterialConsumption,
  type DentalLabMaterial,
  type LabPlatformOrder,
} from '@/utils/labPlatformApi';

const CATEGORIES = [
  { value: 'zirconia', label: 'Диоксид циркония' },
  { value: 'ceramic', label: 'Керамика' },
  { value: 'metal', label: 'Металл' },
  { value: 'alloy', label: 'Сплав' },
  { value: 'resin', label: 'Смола' },
  { value: 'polymer', label: 'Полимер' },
  { value: 'wax', label: 'Воск' },
  { value: 'consumable', label: 'Расходник' },
  { value: 'other', label: 'Другое' },
] as const;

const UNITS = [
  { value: 'g', label: 'г' },
  { value: 'ml', label: 'мл' },
  { value: 'pcs', label: 'шт.' },
] as const;

const PRODUCTION_STATUSES = new Set(['in_progress', 'try_in', 'adjustment', 'remake']);
const field = 'min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary';

function makeIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || `material-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatQuantity(milliValue: string | bigint): string {
  const value = typeof milliValue === 'bigint' ? milliValue : BigInt(milliValue || '0');
  const whole = value / 1000n;
  const fraction = (value % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()},${fraction}` : whole.toString();
}

function formatMinor(value: string | undefined): string {
  if (!value) return '—';
  const minor = BigInt(value);
  const whole = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fraction = (minor % 100n).toString().padStart(2, '0');
  return `${whole},${fraction} ₸`;
}

function orderLabel(order: LabPlatformOrder) {
  return `${order.patientName || 'Пациент без имени'} · ${order.type || 'Работа'} · ${order.id.slice(0, 8)}`;
}

export default function DentalLabMaterialsTab({
  canManage,
  canConsume,
  cacheScope,
}: {
  canManage: boolean;
  canConsume: boolean;
  cacheScope: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [materialDraft, setMaterialDraft] = useState({
    code: '', name: '', category: 'zirconia', unit: 'g', minimumStock: '0',
  });
  const [lotDraft, setLotDraft] = useState({
    lotNumber: '', quantity: '', unitCost: '', supplierName: '', supplierLotNumber: '', expiresAt: '', note: '',
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [consumptionDraft, setConsumptionDraft] = useState({ quantity: '', note: '' });
  const [idempotencyKey, setIdempotencyKey] = useState(makeIdempotencyKey);
  const [reversalReasons, setReversalReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    setMaterialDraft({ code: '', name: '', category: 'zirconia', unit: 'g', minimumStock: '0' });
    setLotDraft({ lotNumber: '', quantity: '', unitCost: '', supplierName: '', supplierLotNumber: '', expiresAt: '', note: '' });
    setSelectedMaterialId('');
    setSelectedLotId('');
    setSelectedOrderId('');
    setConsumptionDraft({ quantity: '', note: '' });
    setIdempotencyKey(makeIdempotencyKey());
    setReversalReasons({});
  }, [cacheScope]);

  const materialsQuery = useQuery({
    queryKey: ['lab-platform', cacheScope, 'materials'],
    queryFn: getDentalLabMaterials,
    refetchInterval: 30_000,
  });
  const ordersQuery = useQuery({
    queryKey: ['lab-platform', cacheScope, 'materials-orders'],
    queryFn: () => getLabPlatformOrders(),
    enabled: canConsume,
    refetchInterval: 30_000,
  });

  const materials = useMemo(() => materialsQuery.data ?? [], [materialsQuery.data]);
  const orders = useMemo(
    () => (ordersQuery.data ?? []).filter((order) => PRODUCTION_STATUSES.has(order.status)),
    [ordersQuery.data],
  );
  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) || materials[0] || null;
  const usableLots = useMemo(
    () => (selectedMaterial?.lots || []).filter((lot) => !lot.expired && BigInt(lot.remainingQuantityMilli) > 0n),
    [selectedMaterial],
  );
  const selectedLot = usableLots.find((lot) => lot.id === selectedLotId) || usableLots[0] || null;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0] || null;
  const consumptionsQuery = useQuery({
    queryKey: ['lab-platform', cacheScope, 'material-consumptions', selectedOrder?.id],
    queryFn: () => getDentalLabOrderMaterialConsumptions(selectedOrder!.id),
    enabled: Boolean(canConsume && selectedOrder?.id),
  });
  const consumptions = consumptionsQuery.data || [];

  useEffect(() => {
    if (materials.length && !materials.some((item) => item.id === selectedMaterialId)) {
      setSelectedMaterialId(materials[0].id);
    }
  }, [materials, selectedMaterialId]);
  useEffect(() => {
    if (!usableLots.some((lot) => lot.id === selectedLotId)) {
      setSelectedLotId(usableLots[0]?.id || '');
    }
  }, [usableLots, selectedLotId]);
  useEffect(() => {
    if (orders.length && !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const invalidateMaterials = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-platform', cacheScope] });
  };

  const createMutation = useMutation({
    mutationFn: () => createDentalLabMaterial({
      code: materialDraft.code.trim().toUpperCase(),
      name: materialDraft.name.trim(),
      category: materialDraft.category,
      unit: materialDraft.unit as 'g' | 'ml' | 'pcs',
      minimumStock: materialDraft.minimumStock.trim() || '0',
    }),
    onSuccess: () => {
      setMaterialDraft({ code: '', name: '', category: 'zirconia', unit: 'g', minimumStock: '0' });
      invalidateMaterials();
      toast.success('Материал добавлен в каталог');
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось создать материал'),
  });

  const receiveMutation = useMutation({
    mutationFn: () => receiveDentalLabMaterialLot(selectedMaterial!.id, {
      lotNumber: lotDraft.lotNumber.trim(),
      quantity: lotDraft.quantity.trim(),
      unitCost: lotDraft.unitCost.trim(),
      supplierName: lotDraft.supplierName.trim() || undefined,
      supplierLotNumber: lotDraft.supplierLotNumber.trim() || undefined,
      expiresAt: lotDraft.expiresAt || undefined,
      note: lotDraft.note.trim() || undefined,
    }),
    onSuccess: () => {
      setLotDraft({ lotNumber: '', quantity: '', unitCost: '', supplierName: '', supplierLotNumber: '', expiresAt: '', note: '' });
      invalidateMaterials();
      toast.success('Партия оприходована');
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось принять партию'),
  });

  const consumeMutation = useMutation({
    mutationFn: () => consumeDentalLabOrderMaterial(selectedOrder!.id, {
      materialId: selectedMaterial!.id,
      lotId: selectedLot!.id,
      quantity: consumptionDraft.quantity.trim(),
      idempotencyKey,
      note: consumptionDraft.note.trim() || undefined,
    }),
    onSuccess: (result: any) => {
      setConsumptionDraft({ quantity: '', note: '' });
      setIdempotencyKey(makeIdempotencyKey());
      invalidateMaterials();
      toast.success(result?.idempotent ? 'Списание уже было зарегистрировано' : 'Расход материала записан в заказ');
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось списать материал'),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ orderId, consumptionId, reason }: { orderId: string; consumptionId: string; reason: string }) =>
      reverseDentalLabOrderMaterialConsumption(orderId, consumptionId, reason),
    onSuccess: () => {
      setReversalReasons({});
      invalidateMaterials();
      toast.success('Материал возвращён в исходную партию');
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось вернуть материал'),
  });

  if (materialsQuery.isError) {
    return <QueryError what="материалы зуботехнической лаборатории" onRetry={() => materialsQuery.refetch()} />;
  }

  const materialDraftValid = materialDraft.code.trim().length >= 2
    && materialDraft.name.trim().length >= 2
    && /^\d+(?:\.\d{1,3})?$/.test(materialDraft.minimumStock || '0');
  const lotDraftValid = selectedMaterial
    && lotDraft.lotNumber.trim().length >= 2
    && /^\d+(?:\.\d{1,3})?$/.test(lotDraft.quantity)
    && Number(lotDraft.quantity) > 0
    && /^\d+(?:\.\d{1,2})?$/.test(lotDraft.unitCost)
    && Number(lotDraft.unitCost) >= 0;
  const consumptionValid = Boolean(selectedOrder && selectedMaterial && selectedLot)
    && /^\d+(?:\.\d{1,3})?$/.test(consumptionDraft.quantity)
    && Number(consumptionDraft.quantity) > 0
    && (!consumptionDraft.note || consumptionDraft.note.trim().length <= 500);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card padding="md">
          <p className="text-xs text-txt-muted">Материалы</p>
          <p className="mt-2 text-2xl font-semibold text-txt-primary">{materials.length}</p>
          <p className="mt-1 text-[11px] text-txt-muted">В каталоге лаборатории</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Недостаточный остаток</p>
          <p className="mt-2 text-2xl font-semibold text-txt-primary">
            {materials.filter((item) => BigInt(item.availableStockMilli) < BigInt(item.minimumStockMilli)).length}
          </p>
          <p className="mt-1 text-[11px] text-txt-muted">Ниже минимального уровня</p>
        </Card>
        <Card padding="md" className="col-span-2 lg:col-span-1">
          <p className="text-xs text-txt-muted">Партии</p>
          <p className="mt-2 text-2xl font-semibold text-txt-primary">{materials.reduce((sum, item) => sum + item.lots.length, 0)}</p>
          <p className="mt-1 text-[11px] text-txt-muted">С серийным учётом и сроком годности</p>
        </Card>
      </div>

      {canManage && (
        <Card padding="md" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">Новый материал</h3>
            <p className="mt-1 text-xs text-txt-muted">Каталог принадлежит этой лаборатории. Единица измерения — базовая для всех партий материала.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs text-txt-secondary">Код<input className={field} value={materialDraft.code} onChange={(event) => setMaterialDraft((v) => ({ ...v, code: event.target.value.toUpperCase() }))} maxLength={40} placeholder="ZIR-98" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Название<input className={field} value={materialDraft.name} onChange={(event) => setMaterialDraft((v) => ({ ...v, name: event.target.value }))} maxLength={120} placeholder="Циркониевый диск" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Категория<select className={field} value={materialDraft.category} onChange={(event) => setMaterialDraft((v) => ({ ...v, category: event.target.value }))}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Единица<select className={field} value={materialDraft.unit} onChange={(event) => setMaterialDraft((v) => ({ ...v, unit: event.target.value }))}>{UNITS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Минимальный остаток<input className={field} value={materialDraft.minimumStock} onChange={(event) => setMaterialDraft((v) => ({ ...v, minimumStock: event.target.value }))} inputMode="decimal" placeholder="0" /></label>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={!materialDraftValid || createMutation.isPending} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>Добавить материал</Button>
          </div>
        </Card>
      )}

      {canManage && (
        <Card padding="md" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">Приход партии</h3>
            <p className="mt-1 text-xs text-txt-muted">Стоимость фиксируется для этой партии и будет использоваться в себестоимости конкретных работ.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs text-txt-secondary">Материал<select className={field} value={selectedMaterial?.id || ''} onChange={(event) => setSelectedMaterialId(event.target.value)}>{materials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Номер партии<input className={field} value={lotDraft.lotNumber} onChange={(event) => setLotDraft((v) => ({ ...v, lotNumber: event.target.value }))} maxLength={80} placeholder="LOT-2026-001" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Количество ({UNITS.find((x) => x.value === selectedMaterial?.unit)?.label || selectedMaterial?.unit || 'ед.'})<input className={field} value={lotDraft.quantity} onChange={(event) => setLotDraft((v) => ({ ...v, quantity: event.target.value }))} inputMode="decimal" placeholder="10.000" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Закупочная цена за единицу, ₸<input className={field} value={lotDraft.unitCost} onChange={(event) => setLotDraft((v) => ({ ...v, unitCost: event.target.value }))} inputMode="decimal" placeholder="12500.00" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Поставщик<input className={field} value={lotDraft.supplierName} onChange={(event) => setLotDraft((v) => ({ ...v, supplierName: event.target.value }))} maxLength={120} /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Партия производителя<input className={field} value={lotDraft.supplierLotNumber} onChange={(event) => setLotDraft((v) => ({ ...v, supplierLotNumber: event.target.value }))} maxLength={120} /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Годен до<input className={field} type="date" value={lotDraft.expiresAt} onChange={(event) => setLotDraft((v) => ({ ...v, expiresAt: event.target.value }))} /></label>
          </div>
          <label className="block space-y-1 text-xs text-txt-secondary">Документ / комментарий<textarea className="min-h-16 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" value={lotDraft.note} onChange={(event) => setLotDraft((v) => ({ ...v, note: event.target.value }))} maxLength={500} placeholder="Номер накладной, сертификат партии или примечание" /></label>
          <div className="flex justify-end">
            <Button size="sm" disabled={!lotDraftValid || receiveMutation.isPending || !selectedMaterial} loading={receiveMutation.isPending} onClick={() => receiveMutation.mutate()}><PackagePlus size={14} /> Оприходовать партию</Button>
          </div>
        </Card>
      )}

      <Card padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-txt-primary">Склад материалов</h3><p className="mt-1 text-xs text-txt-muted">Остатки рассчитаны по партиям; просроченные партии нельзя списывать в производство.</p></div>
          <Badge variant="outline">{materials.length} позиций</Badge>
        </div>
        {materialsQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-bdr-subtle p-8 text-center">
            <Boxes className="mx-auto mb-2 text-txt-muted" size={28} />
            <p className="text-sm font-medium text-txt-primary">Каталог материалов пуст</p>
            <p className="mt-1 text-xs text-txt-muted">Добавьте используемые материалы и зарегистрируйте первую партию.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {materials.map((item: DentalLabMaterial) => {
              const low = BigInt(item.availableStockMilli) < BigInt(item.minimumStockMilli);
              return (
                <div key={item.id} className="space-y-3 rounded-xl border border-bdr-subtle p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-semibold text-txt-primary">{item.name}</p><p className="mt-1 text-xs text-txt-muted">{item.code} · {CATEGORIES.find((x) => x.value === item.category)?.label || item.category}</p></div>
                    <Badge variant={!item.active ? 'outline' : low ? 'warning' : 'success'}>{!item.active ? 'Архив' : low ? 'Низкий остаток' : 'В наличии'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold tabular-nums text-txt-primary">{formatQuantity(item.availableStockMilli)} {UNITS.find((x) => x.value === item.unit)?.label || item.unit}</p>
                    <p className="text-xs text-txt-muted">Минимум: {formatQuantity(item.minimumStockMilli)}</p>
                  </div>
                  <div className="space-y-2 border-t border-bdr-subtle pt-2">
                    {item.lots.map((lot) => (
                      <div key={lot.id} className="rounded-lg bg-surface-2 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-txt-primary">Партия {lot.lotNumber}</span><Badge variant={lot.expired ? 'error' : 'outline'}>{lot.expired ? 'Просрочена' : 'Активна'}</Badge></div>
                        <div className="mt-1 flex flex-wrap justify-between gap-2 text-txt-secondary">
                          <span>Остаток: {formatQuantity(lot.remainingQuantityMilli)} {item.unit}</span>
                          <span>Закупка: {formatMinor(lot.unitCostMinor)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-txt-muted">{lot.supplierName || 'Поставщик не указан'}{lot.expiresAt ? ` · годен до ${new Date(lot.expiresAt).toLocaleDateString('ru-RU')}` : ''}</p>
                      </div>
                    ))}
                    {!item.lots.length && <p className="text-xs text-txt-muted">Партии ещё не поступали.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {canConsume && (
        <Card padding="md" className="space-y-3">
          <div><h3 className="text-sm font-semibold text-txt-primary">Списание на заказ</h3><p className="mt-1 text-xs text-txt-muted">Техник списывает материал только по назначенному ему заказу. Остаток уменьшается в транзакции, повторный запрос не создаёт двойного расхода.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-txt-secondary sm:col-span-2">Заказ<select className={field} value={selectedOrder?.id || ''} onChange={(event) => setSelectedOrderId(event.target.value)}>{orders.map((order) => <option key={order.id} value={order.id}>{orderLabel(order)}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Материал<select className={field} value={selectedMaterial?.id || ''} onChange={(event) => setSelectedMaterialId(event.target.value)}>{materials.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Партия<select className={field} value={selectedLot?.id || ''} onChange={(event) => setSelectedLotId(event.target.value)}>{usableLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · остаток {formatQuantity(lot.remainingQuantityMilli)} {selectedMaterial?.unit}</option>)}</select></label>
            <label className="space-y-1 text-xs text-txt-secondary">Количество ({selectedMaterial?.unit || 'ед.'})<input className={field} value={consumptionDraft.quantity} onChange={(event) => setConsumptionDraft((v) => ({ ...v, quantity: event.target.value }))} inputMode="decimal" placeholder="0.250" /></label>
            <label className="space-y-1 text-xs text-txt-secondary">Примечание<input className={field} value={consumptionDraft.note} onChange={(event) => setConsumptionDraft((v) => ({ ...v, note: event.target.value }))} maxLength={500} placeholder="Этап, участок или комментарий" /></label>
          </div>
          {!selectedOrder && <p className="rounded-lg bg-surface-2 p-3 text-xs text-txt-muted">Нет назначенных работ, на которые можно списать материал.</p>}
          {selectedMaterial && !usableLots.length && <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">Нет доступных партий: проверьте остатки и сроки годности.</p>}
          <div className="flex justify-end"><Button size="sm" disabled={!consumptionValid || consumeMutation.isPending} loading={consumeMutation.isPending} onClick={() => consumeMutation.mutate()}><Scissors size={14} /> Списать на заказ</Button></div>
          {consumptionsQuery.isError && <QueryError what="история расхода материалов" onRetry={() => consumptionsQuery.refetch()} />}
          <div className="space-y-2 border-t border-bdr-subtle pt-3">
            <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-txt-primary">Расход по выбранному заказу</h4><Badge variant="outline">{consumptions.length} операций</Badge></div>
            {consumptionsQuery.isLoading ? <Skeleton className="h-20" /> : consumptions.length === 0 ? <p className="py-3 text-center text-xs text-txt-muted">Материалы на заказ пока не списывались.</p> : consumptions.map((row) => (
              <div key={row.id} className="space-y-2 rounded-lg border border-bdr-subtle p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-txt-primary">{row.material.name} · партия {row.lot.lotNumber}</span><Badge variant={row.reversedAt ? 'outline' : 'success'}>{row.reversedAt ? 'Возвращено' : 'Списано'}</Badge></div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-txt-secondary"><span>{formatQuantity(row.quantityMilli)} {row.material.unit}</span><span>{formatMinor(row.totalCostMinorSnapshot)}</span></div>
                <p className="text-[11px] text-txt-muted">{new Date(row.consumedAt).toLocaleString('ru-RU')}{row.reversedAt ? ` · возврат ${new Date(row.reversedAt).toLocaleString('ru-RU')}` : ''}</p>
                {row.reversalReason && <p className="text-xs text-txt-muted">Причина возврата: {row.reversalReason}</p>}
                {canManage && !row.reversedAt && (
                  <div className="flex flex-col gap-2 border-t border-bdr-subtle pt-2 sm:flex-row">
                    <input className={field} value={reversalReasons[row.id] || ''} onChange={(event) => setReversalReasons((v) => ({ ...v, [row.id]: event.target.value }))} maxLength={2000} placeholder="Причина отмены списания (от 10 символов)" />
                    <Button size="sm" variant="outline" disabled={(reversalReasons[row.id] || '').trim().length < 10 || reverseMutation.isPending} loading={reverseMutation.isPending} onClick={() => reverseMutation.mutate({ orderId: selectedOrder!.id, consumptionId: row.id, reason: reversalReasons[row.id].trim() })}><RotateCcw size={14} /> Вернуть</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="md" className="flex items-start gap-3">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-txt-muted" />
        <p className="text-xs leading-relaxed text-txt-muted">Партии с истёкшим сроком годности исключаются из доступного остатка. Закупочная стоимость фиксируется при списании и не изменяет цену принятого клиникой заказа, DentVision-комиссию или баланс кошелька.</p>
      </Card>
    </div>
  );
}
