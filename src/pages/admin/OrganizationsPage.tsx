import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader, Card, CardContent, Button, Badge, Modal,
  Input, Select, Textarea, EmptyState,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { getOrganizations, createOrganization, updateOrganization, deleteOrganization, getOrganizationTypes } from '../../utils/api';
import { Building2, Plus, Search, RefreshCw, Pencil, Trash2, ExternalLink } from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const ORG_TYPE_LABEL: Record<string, string> = {
  CLINIC: 'Клиника',
  ACADEMY: 'Академия',
  LABORATORY: 'Лаборатория',
  DIAGNOSTIC_CENTER: 'Диагностический центр',
  SUPPLIER_COMPANY: 'Поставщик',
  PARTNER: 'Партнёр',
};

const ORG_TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'CLINIC', label: 'Клиника' },
  { value: 'ACADEMY', label: 'Академия' },
  { value: 'LABORATORY', label: 'Лаборатория' },
  { value: 'DIAGNOSTIC_CENTER', label: 'Диагностический центр' },
  { value: 'SUPPLIER_COMPANY', label: 'Поставщик' },
  { value: 'PARTNER', label: 'Партнёр' },
];

export default function OrganizationsPage() {
  const { showToast: toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'CLINIC', taxId: '', address: '', phone: '', email: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', typeFilter, search, page],
    queryFn: () => getOrganizations({ type: typeFilter || undefined, search: search || undefined, page, limit: 20 }),
  });

  const { data: typesData } = useQuery({
    queryKey: ['organization-types'],
    queryFn: getOrganizationTypes,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => editId ? updateOrganization(editId, d) : createOrganization(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setShowModal(false);
      setEditId(null);
      setForm({ name: '', type: 'CLINIC', taxId: '', address: '', phone: '', email: '' });
      toast('Организация сохранена', 'success');
    },
    onError: () => toast('Ошибка при сохранении', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast('Организация удалена', 'success');
    },
    onError: () => toast('Ошибка при удалении', 'error'),
  });

  const orgs = data?.data || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  function openEdit(org: any) {
    setEditId(org.id);
    setForm({ name: org.name, type: org.type, taxId: org.taxId || '', address: org.address || '', phone: org.phone || '', email: org.email || '' });
    setShowModal(true);
  }

  function openCreate() {
    setEditId(null);
    setForm({ name: '', type: 'CLINIC', taxId: '', address: '', phone: '', email: '' });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.type) return;
    createMut.mutate(form);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Организации"
        icon={<Building2 size={24} />}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" onClick={openCreate}><Plus size={16} /> Создать</Button>
          </div>
        }
      />

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="w-48">
              <Select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                options={ORG_TYPE_OPTIONS}
              />
            </div>
            <div className="w-64">
              <Input
                placeholder="Поиск по названию..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Загрузка...</div>
          ) : orgs.length === 0 ? (
            <EmptyState icon={<Building2 size={48} />} title="Нет организаций" description="Создайте первую организацию" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="text-left py-3 px-2">Название</th>
                    <th className="text-left py-3 px-2">Тип</th>
                    <th className="text-left py-3 px-2">Телефон</th>
                    <th className="text-left py-3 px-2">Email</th>
                    <th className="text-left py-3 px-2">Дата создания</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org: any) => (
                    <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-2 font-medium">{org.name}</td>
                      <td className="py-3 px-2">
                        <Badge variant={org.type === 'CLINIC' ? 'gold' : 'info'}>
                          {ORG_TYPE_LABEL[org.type] || org.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-slate-400">{org.phone || '—'}</td>
                      <td className="py-3 px-2 text-slate-400">{org.email || '—'}</td>
                      <td className="py-3 px-2 text-slate-400">{fd(org.createdAt)}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon-sm" variant="ghost" onClick={() => openEdit(org)} title="Редактировать">
                            <Pencil size={14} />
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => { if (confirm('Удалить?')) deleteMut.mutate(org.id); }} title="Удалить">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Назад</Button>
              <span className="text-sm text-slate-400 self-center">{pagination.page} / {pagination.pages}</span>
              <Button variant="ghost" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Редактировать организацию' : 'Создать организацию'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название *" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Select label="Тип *" value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} options={ORG_TYPE_OPTIONS.filter(o => o.value)} />
          <Input label="БИН/ИНН" value={form.taxId} onChange={(e) => setForm(f => ({ ...f, taxId: e.target.value }))} />
          <Input label="Адрес" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
          <Input label="Телефон" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Отмена</Button>
            <Button variant="primary" type="submit" loading={createMut.isPending}>Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
