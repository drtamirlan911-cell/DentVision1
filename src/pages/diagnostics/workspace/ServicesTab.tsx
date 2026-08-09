import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useToast } from '@/components/ui/ds/Toast';
import type { TabProps } from './types';

const DIAG_CATEGORIES = ['CBCT', 'OPG', 'TRG', 'TMJ', 'STL', 'FACE_SCAN', 'DICOM', 'ALLERGY', 'HISTOLOGY', 'PCR', 'MICROBIOLOGY', 'BLOOD', 'GENETICS', 'BIOPSY', 'SALIVA', 'PATHOLOGY', 'OTHER'];

export function ServicesTab({ config, orgId }: TabProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: studiesData, isLoading } = useQuery({
    queryKey: ['diagnostics', 'pricing', config.kind, orgId],
    queryFn: () => config.getPricing(orgId),
    enabled: !!orgId,
  });

  const studies = Array.isArray(studiesData?.data) ? studiesData.data : [];
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'CBCT', price: '' });

  useEffect(() => {
    if (studies.length > 0) {
      const initial: Record<string, string> = {};
      studies.forEach((s: any) => { initial[s.id] = String(s.price || ''); });
      setPrices((prev) => Object.keys(initial).some((k) => initial[k] !== prev[k]) ? initial : prev);
    }
  }, [studies]);

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; price: number }[]) => config.updatePricing(orgId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diagnostics', 'pricing', config.kind, orgId] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; category: string; price?: number }) => config.createService(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'pricing', config.kind, orgId] });
      setAddOpen(false);
      setAddForm({ name: '', category: 'CBCT', price: '' });
      toast.success('Услуга добавлена');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    const updates = Object.entries(prices)
      .filter(([, v]) => v !== '')
      .map(([id, price]) => ({ id, price: parseFloat(price) }));
    if (updates.length > 0) saveMutation.mutate(updates);
  };

  const handleCreate = () => {
    if (!addForm.name.trim()) { toast.error('Укажите название услуги'); return; }
    createMutation.mutate({ name: addForm.name.trim(), category: addForm.category, price: parseFloat(addForm.price) || 0 });
  };

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-txt-primary">Прайс-лист услуг</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="min-h-11" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Добавить услугу</Button>
          <Button variant="primary" size="sm" className="min-h-11" icon={<Save size={14} />} onClick={handleSave} loading={saveMutation.isPending}>Сохранить</Button>
        </div>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                <th className="pb-2 pr-3">Услуга</th>
                <th className="pb-2 pr-3">Категория</th>
                <th className="pb-2 pr-3">Цена (₸)</th>
                <th className="pb-2 pr-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s: any) => (
                <tr key={s.id} className="border-b border-bdr-subtle/50">
                  <td className="py-2.5 pr-3 font-medium text-txt-primary">{s.name}</td>
                  <td className="py-2.5 pr-3 text-txt-muted">{s.category}</td>
                  <td className="py-2.5 pr-3">
                    <input type="number" value={prices[s.id] ?? ''} onChange={(e) => setPrices((p: any) => ({ ...p, [s.id]: e.target.value }))} className="w-28 min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-2 py-1 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                  </td>
                  <td className="py-2.5 pr-3"><Badge variant="outline" className={s.active ? 'border-success text-success' : 'border-error text-error'}>{s.active ? 'Активна' : 'Не активна'}</Badge></td>
                </tr>
              ))}
              {studies.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-txt-muted">Нет услуг. Добавьте первую услугу.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddOpen(false)}>
          <Card padding="lg" className="max-w-sm w-full mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Добавить услугу</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Название услуги</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Напр. Конусно-лучевая КТ" className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Категория</label>
                <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))} className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
                  {DIAG_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Цена (₸)</label>
                <input type="number" value={addForm.price} onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))} placeholder="Напр. 15000" className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setAddOpen(false)}>Отмена</Button>
                <Button variant="primary" size="sm" className="min-h-11" onClick={handleCreate} loading={createMutation.isPending} disabled={!addForm.name.trim()}>Добавить</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
