import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { apiRequest } from '../../utils/api';
import {
  Users, Plus, Search, ChevronDown, ChevronRight, FileText, Receipt,
} from 'lucide-react';

const PARTNER_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Физ. лицо' },
  { value: 'LEGAL_ENTITY', label: 'Юр. лицо' },
  { value: 'SOLE_PROPRIETOR', label: 'ИП' },
  { value: 'NON_PROFIT', label: 'НКО' },
  { value: 'CLINIC', label: 'Клиника' },
  { value: 'DIAGNOSTIC_CENTER', label: 'Диагностический центр' },
  { value: 'SUPPLIER', label: 'Поставщик' },
  { value: 'LECTURER', label: 'Лектор' },
  { value: 'EDUCATION_CENTER', label: 'Учебный центр' },
  { value: 'RESELLER', label: 'Реселлер' },
  { value: 'CORPORATE', label: 'Корпоративный' },
];

const PARTNER_TYPE_BADGE: Record<string, 'info' | 'success' | 'warning' | 'gold' | 'default'> = {
  INDIVIDUAL: 'info',
  LEGAL_ENTITY: 'success',
  SOLE_PROPRIETOR: 'warning',
  NON_PROFIT: 'gold',
  CLINIC: 'info',
  DIAGNOSTIC_CENTER: 'success',
  SUPPLIER: 'warning',
  LECTURER: 'gold',
  EDUCATION_CENTER: 'info',
  RESELLER: 'warning',
  CORPORATE: 'gold',
};

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

interface PartnerForm {
  type: string;
  legalName: string;
  bin: string;
  director: string;
  address: string;
  iban: string;
  phone: string;
  email: string;
  commission: string;
}

const EMPTY_FORM: PartnerForm = {
  type: 'LEGAL_ENTITY',
  legalName: '',
  bin: '',
  director: '',
  address: '',
  iban: '',
  phone: '',
  email: '',
  commission: '',
};

export default function LegalPartners() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const partners = useQuery({
    queryKey: ['legal', 'partners'],
    queryFn: () => apiRequest('/api/legal/partners'),
    staleTime: 30_000,
  });

  const createPartner = useMutation({
    mutationFn: (data: PartnerForm) => apiRequest('/api/legal/partners', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        commission: data.commission ? Number(data.commission) : undefined,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'partners'] });
      toast.success('Партнёр создан. Договор сгенерирован автоматически.');
      setModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания'),
  });

  const partnerList: any[] = Array.isArray(partners.data) ? partners.data : (partners.data?.data || []);

  const filteredList = partnerList.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(p.legalName || p.name || '').toLowerCase().includes(q)
      || String(p.bin || '').toLowerCase().includes(q)
      || String(p.director || '').toLowerCase().includes(q);
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск партнёров..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setModal(true); }}>
          Создать партнёра
        </Button>
      </div>

      {partners.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Нет партнёров"
          description={search ? 'Измените поисковый запрос' : 'Создайте первого партнёра'}
          action={!search ? <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setModal(true); }}>Создать партнёра</Button> : undefined}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Наименование', 'Тип', 'БИН', 'Директор', 'Документов', 'Счетов', 'Создан', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.map((p: any) => (
                  <>
                    <tr key={p.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleExpand(p.id)}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary">{p.legalName || p.name || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PARTNER_TYPE_BADGE[p.type] || 'default'} size="sm">
                          {PARTNER_TYPE_OPTIONS.find(o => o.value === p.type)?.label || p.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{p.bin || '—'}</td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{p.director || '—'}</td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{p.documentsCount ?? p.documents?.length ?? 0}</td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{p.invoicesCount ?? p.invoices?.length ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{fd(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button size="icon-sm" variant="ghost" aria-label="Подробнее" title="Подробнее">
                          {expandedId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr key={`${p.id}-expanded`}>
                        <td colSpan={8} className="px-4 py-3 bg-surface-2/50">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                <FileText size={14} /> Документы
                              </h4>
                              {Array.isArray(p.documents) && p.documents.length > 0 ? (
                                <div className="space-y-1">
                                  {p.documents.map((d: any) => (
                                    <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                                      <FileText size={14} className="text-txt-muted shrink-0" />
                                      <span className="text-sm text-txt-primary flex-1 min-w-0 truncate">{d.documentNumber || d.name || '—'}</span>
                                      <Badge variant={d.status === 'PUBLISHED' ? 'success' : 'default'} size="xs">{d.status || '—'}</Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-txt-muted">Нет документов</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Receipt size={14} /> Счета
                              </h4>
                              {Array.isArray(p.invoices) && p.invoices.length > 0 ? (
                                <div className="space-y-1">
                                  {p.invoices.map((inv: any) => (
                                    <div key={inv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                                      <Receipt size={14} className="text-txt-muted shrink-0" />
                                      <span className="text-sm text-txt-primary flex-1 min-w-0 truncate">{inv.number || inv.name || '—'}</span>
                                      <span className="text-xs text-txt-muted">{inv.amount ? `${inv.amount.toLocaleString('ru-RU')} ₸` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-txt-muted">Нет счетов</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modal} onClose={() => { setModal(false); setForm(EMPTY_FORM); }} title="Новый партнёр">
        <form onSubmit={e => {
          e.preventDefault();
          if (!form.legalName.trim()) { toast.warn('Введите наименование'); return; }
          createPartner.mutate(form);
        }} className="space-y-4">
          <Select label="Тип *" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={PARTNER_TYPE_OPTIONS} />
          <Input label="Наименование *" value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} required placeholder="Полное наименование" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="БИН" value={form.bin} onChange={e => setForm({ ...form, bin: e.target.value })} placeholder="БИН/ИИН" />
            <Input label="Директор" value={form.director} onChange={e => setForm({ ...form, director: e.target.value })} placeholder="ФИО руководителя" />
          </div>
          <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Юридический адрес" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="IBAN" value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} placeholder="KZ123456..." />
            <Input label="Комиссия (%)" type="number" step="0.01" min="0" max="100" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} placeholder="5.00" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+7 (XXX) XXX-XX-XX" />
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="email@example.com" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createPartner.isPending}>Создать партнёра</Button>
            <Button type="button" variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_FORM); }}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
