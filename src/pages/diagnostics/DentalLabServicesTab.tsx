import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useToast } from '@/components/ui/ds/Toast';
import { createDentalLabService, getDentalLabServices, updateDentalLabService, type DentalLabService } from '@/utils/labPlatformApi';

const CATEGORIES = [
  { value: 'crown', label: 'Коронки' }, { value: 'bridge', label: 'Мосты' },
  { value: 'veneer', label: 'Виниры' }, { value: 'implant', label: 'Работы на имплантах' },
  { value: 'denture', label: 'Съёмные протезы' }, { value: 'nightguard', label: 'Капы' },
  { value: 'wax', label: 'Wax-Up / моделирование' }, { value: 'other', label: 'Другое' },
];
type Draft = { code: string; name: string; category: string; description: string; material: string; defaultPrice: string; turnaroundDays: string };
const EMPTY: Draft = { code: '', name: '', category: 'crown', description: '', material: '', defaultPrice: '', turnaroundDays: '7' };

export function DentalLabServicesTab({ canManage, cacheScope }: { canManage: boolean; cacheScope: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['lab-platform', cacheScope, 'services'], queryFn: getDentalLabServices });
  const services = query.data || [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        code: draft.code.trim().toUpperCase(), name: draft.name.trim(), category: draft.category,
        description: draft.description.trim() || undefined, material: draft.material.trim() || undefined,
        defaultPrice: Number(draft.defaultPrice), turnaroundDays: Number(draft.turnaroundDays),
      };
      return editing ? updateDentalLabService(editing, body) : createDentalLabService(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-platform', cacheScope, 'services'] });
      setDraft(EMPTY); setEditing(null);
      toast.success(editing ? 'Услуга обновлена' : 'Услуга добавлена');
    },
    onError: (error: Error) => toast.error(error.message || 'Не удалось сохранить услугу'),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateDentalLabService(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-platform', cacheScope, 'services'] }),
    onError: (error: Error) => toast.error(error.message || 'Не удалось изменить публикацию услуги'),
  });
  const beginEdit = (item: DentalLabService) => {
    setEditing(item.id);
    setDraft({
      code: item.code, name: item.name, category: item.category, description: item.description || '',
      material: item.material || '', defaultPrice: String(item.defaultPrice), turnaroundDays: String(item.turnaroundDays),
    });
  };
  const update = (key: keyof Draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const valid = draft.code.trim().length >= 2 && draft.name.trim().length >= 2
    && Number.isSafeInteger(Number(draft.defaultPrice)) && Number(draft.defaultPrice) > 0
    && Number.isInteger(Number(draft.turnaroundDays)) && Number(draft.turnaroundDays) >= 1;

  if (query.isError) return <QueryError what="каталог услуг зуботехнической лаборатории" onRetry={() => query.refetch()} />;
  const field = 'min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary';

  return (
    <div className="space-y-4">
      {canManage && <Card padding="md" className="space-y-3">
        <div><h3 className="text-sm font-semibold text-txt-primary">{editing ? 'Изменить услугу' : 'Новая услуга и тариф'}</h3><p className="mt-1 text-xs text-txt-muted">Цена фиксируется в заказе при передаче. Изменение прайса не переписывает уже принятые кейсы.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-txt-secondary">Код услуги<input className={field} value={draft.code} onChange={e => update('code', e.target.value.toUpperCase())} maxLength={40} placeholder="CROWN-ZR" /></label>
          <label className="space-y-1 text-xs text-txt-secondary">Название<input className={field} value={draft.name} onChange={e => update('name', e.target.value)} maxLength={120} placeholder="Коронка из диоксида циркония" /></label>
          <label className="space-y-1 text-xs text-txt-secondary">Категория<select className={field} value={draft.category} onChange={e => update('category', e.target.value)}>{CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="space-y-1 text-xs text-txt-secondary">Материал<input className={field} value={draft.material} onChange={e => update('material', e.target.value)} maxLength={80} placeholder="Zirconia HT" /></label>
          <label className="space-y-1 text-xs text-txt-secondary">Цена, ₸<input className={field} type="number" min={1} step={1} value={draft.defaultPrice} onChange={e => update('defaultPrice', e.target.value)} placeholder="52000" /></label>
          <label className="space-y-1 text-xs text-txt-secondary">Срок выполнения, дней<input className={field} type="number" min={1} max={365} step={1} value={draft.turnaroundDays} onChange={e => update('turnaroundDays', e.target.value)} /></label>
        </div>
        <label className="block space-y-1 text-xs text-txt-secondary">Описание<textarea className="min-h-20 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" value={draft.description} onChange={e => update('description', e.target.value)} maxLength={1500} placeholder="Состав, комплектация и ограничения услуги..." /></label>
        <div className="flex flex-wrap justify-end gap-2">
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setDraft(EMPTY); }}>Отмена</Button>}
          <Button disabled={!valid || saveMutation.isPending} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{editing ? 'Сохранить изменения' : 'Добавить в каталог'}</Button>
        </div>
      </Card>}
      <Card padding="md">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-txt-primary">Прайс-лист лаборатории</h3><p className="mt-1 text-xs text-txt-muted">{services.filter(item => item.active).length} опубликованных · {services.length} всего</p></div><Badge variant="outline">KZT</Badge></div>
        {query.isLoading ? <div className="mt-4 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : services.length === 0 ? <p className="py-8 text-center text-sm text-txt-muted">Каталог пуст. Добавьте услуги, чтобы клиники могли видеть тарифы и сроки до передачи заказа.</p> : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {services.map(item => <div key={item.id} className="space-y-2 rounded-xl border border-bdr-subtle p-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-txt-primary">{item.name}</p><p className="mt-1 text-xs text-txt-muted">{CATEGORIES.find(c => c.value === item.category)?.label || item.category} · {item.code}</p></div><Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Опубликована' : 'Скрыта'}</Badge></div>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-lg font-semibold tabular-nums text-txt-primary">{item.defaultPrice.toLocaleString('ru-RU')} ₸</p><p className="text-xs text-txt-muted">{item.material || 'Материал не указан'} · {item.turnaroundDays} дн.</p></div>
              {item.description && <p className="text-xs text-txt-secondary">{item.description}</p>}
              {canManage && <div className="flex flex-wrap justify-end gap-2 border-t border-bdr-subtle pt-2"><Button size="sm" variant="outline" onClick={() => beginEdit(item)}>Изменить</Button><Button size="sm" variant="ghost" loading={toggleMutation.isPending} onClick={() => toggleMutation.mutate({ id: item.id, active: !item.active })}>{item.active ? 'Снять с публикации' : 'Опубликовать'}</Button></div>}
            </div>)}
          </div>
        )}
      </Card>
    </div>
  );
}
export default DentalLabServicesTab;
