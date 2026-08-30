import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, Button, Badge, Modal, Input, Select, EmptyState, Skeleton } from '../../components/ui/ds';
import { useToast, ConfirmModal } from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import { Receipt, Plus, Search } from 'lucide-react';

const fmtKzt = (n: any) => new Intl.NumberFormat('ru-RU').format(Number(n || 0) / 100) + ' ₸';
const fd = (d: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

const statusColors: Record<string, string> = {
  unpaid: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  refund: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  partial: 'bg-gold-500/10 text-dv-gold border-dv-gold/20',
};

export default function LegalInvoices() {
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ partnerId: '', amountKzt: '', dueAt: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['legal-invoices'],
    queryFn: () => apiRequest('/api/legal/invoices'),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => apiRequest('/api/legal/invoices', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-invoices'] }); setCreateModal(false); toast.showToast('Инвойс создан', 'success'); },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: any) => apiRequest(`/api/legal/invoices/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-invoices'] }); toast.showToast('Статус обновлён', 'success'); },
  });

  /** Инвойс, отметка об оплате которого ждёт подтверждения. */
  const [toMarkPaid, setToMarkPaid] = useState<{ id: string; number: string; amount: number } | null>(null);

  const invoices = data?.data || [];
  const filtered = invoices.filter((i: any) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (search && !i.invoiceNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-48 min-h-11" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary px-2 py-1.5 min-h-11">
            <option value="">Все статусы</option>
            {['unpaid', 'paid', 'overdue', 'pending', 'refund', 'partial'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setForm({ partnerId: '', amountKzt: '', dueAt: '', description: '' }); setCreateModal(true); }} className="min-h-11">Инвойс</Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-bdr-subtle">
              {['Номер', 'Партнёр', 'Сумма', 'Статус', 'Создан', 'Оплачен', 'Действия'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv: any) => (
              <tr key={inv.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/50">
                <td className="px-4 py-3 text-sm font-mono text-txt-primary">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-sm text-txt-secondary">{inv.partner?.legalName || '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-txt-primary">{fmtKzt(inv.amountKzt)}</td>
                <td className="px-4 py-3"><Badge size="xs" className={statusColors[inv.status] || ''}>{inv.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-txt-muted">{fd(inv.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-txt-muted">{inv.paidAt ? fd(inv.paidAt) : inv.dueAt ? fd(inv.dueAt) : '—'}</td>
                <td className="px-4 py-3">
                  {inv.status === 'unpaid' && <Button size="xs" onClick={() => setToMarkPaid({ id: inv.id, number: inv.invoiceNumber, amount: inv.amountKzt })}>Оплачен</Button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12"><EmptyState icon={<Receipt size={40} />} title="Нет инвойсов" description="Создайте первый инвойс" /></td></tr>}
          </tbody>
        </table>
        </div>
      </Card>

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Новый инвойс">
        <div className="space-y-4">
          <Input label="ID партнёра *" value={form.partnerId} onChange={e => setForm({ ...form, partnerId: e.target.value })} />
          <Input label="Сумма (KZT) *" type="number" value={form.amountKzt} onChange={e => setForm({ ...form, amountKzt: e.target.value })} />
          <Input label="Дата оплаты" type="date" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} />
          <Input label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="text-xs text-txt-muted">Сумма будет сконвертирована в тиын (1 KZT = 100 тиын)</div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate({ partnerId: form.partnerId, amountKzt: String(Number(form.amountKzt) * 100), dueAt: form.dueAt, description: form.description })} loading={createMutation.isPending}>Создать</Button>
            <Button variant="ghost" onClick={() => setCreateModal(false)}>Отмена</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!toMarkPaid}
        onClose={() => setToMarkPaid(null)}
        onConfirm={() => { if (toMarkPaid) statusMutation.mutate({ id: toMarkPaid.id, status: 'paid' }); }}
        title="Отметить инвойс оплаченным?"
        message={toMarkPaid ? `Инвойс ${toMarkPaid.number} на ${fmtKzt(toMarkPaid.amount)} перейдёт в статус «оплачен».` : ''}
        confirmLabel="Отметить оплаченным"
        variant="warning"
      />
    </div>
  );
}
