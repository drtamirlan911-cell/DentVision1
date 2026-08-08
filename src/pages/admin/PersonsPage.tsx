import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader, Card, CardContent, Button, Badge, Modal,
  Input, Select, EmptyState,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { getPersons, createPerson, updatePerson, deletePerson, getOrganizations } from '../../utils/api';
import { Users, Plus, Search, Pencil, Trash2 } from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const PERSON_TYPE_LABEL: Record<string, string> = {
  DOCTOR: 'Врач',
  LECTURER: 'Лектор',
  SELLER: 'Продавец',
  SUPPLIER_REP: 'Представитель поставщика',
  STAFF: 'Сотрудник',
  OPERATOR: 'Оператор',
  RADIOLOGIST: 'Радиолог',
};

const PERSON_TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'DOCTOR', label: 'Врач' },
  { value: 'LECTURER', label: 'Лектор' },
  { value: 'SELLER', label: 'Продавец' },
  { value: 'SUPPLIER_REP', label: 'Представитель поставщика' },
  { value: 'STAFF', label: 'Сотрудник' },
  { value: 'OPERATOR', label: 'Оператор' },
  { value: 'RADIOLOGIST', label: 'Радиолог' },
];

export default function PersonsPage() {
  const { showToast: toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', personType: 'DOCTOR', organizationId: '', phone: '', email: '', specialization: '', bio: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['persons', typeFilter, orgFilter, search, page],
    queryFn: () => getPersons({ personType: typeFilter || undefined, organizationId: orgFilter || undefined, search: search || undefined, page, limit: 20 }),
  });

  const { data: orgsData } = useQuery({
    queryKey: ['organizations-list-light'],
    queryFn: () => getOrganizations({ limit: 200 }),
  });

  const orgs = orgsData?.data || [];
  const orgOptions = [{ value: '', label: 'Все организации' }, ...orgs.map((o: any) => ({ value: o.id, label: o.name }))];

  const createMut = useMutation({
    mutationFn: (d: any) => editId ? updatePerson(editId, d) : createPerson(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setShowModal(false);
      setEditId(null);
      setForm({ fullName: '', personType: 'DOCTOR', organizationId: '', phone: '', email: '', specialization: '', bio: '' });
      toast('Персона сохранена', 'success');
    },
    onError: () => toast('Ошибка при сохранении', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      toast('Персона удалена', 'success');
    },
    onError: () => toast('Ошибка при удалении', 'error'),
  });

  const persons = data?.data || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  function openEdit(p: any) {
    setEditId(p.id);
    setForm({ fullName: p.fullName, personType: p.personType, organizationId: p.organizationId || '', phone: p.phone || '', email: p.email || '', specialization: p.specialization || '', bio: p.bio || '' });
    setShowModal(true);
  }

  function openCreate() {
    setEditId(null);
    setForm({ fullName: '', personType: 'DOCTOR', organizationId: '', phone: '', email: '', specialization: '', bio: '' });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName || !form.personType) return;
    createMut.mutate({ ...form, organizationId: form.organizationId || undefined });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Персоны"
        icon={<Users size={24} />}
        actions={
          <Button variant="primary" onClick={openCreate}><Plus size={16} /> Создать</Button>
        }
      />

      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="w-44">
              <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} options={PERSON_TYPE_OPTIONS} />
            </div>
            <div className="w-56">
              <Select value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }} options={orgOptions} />
            </div>
            <div className="w-64">
              <Input placeholder="Поиск по имени..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Загрузка...</div>
          ) : persons.length === 0 ? (
            <EmptyState icon={<Users size={48} />} title="Нет персон" description="Создайте первую запись" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="text-left py-3 px-2">Имя</th>
                    <th className="text-left py-3 px-2">Тип</th>
                    <th className="text-left py-3 px-2">Организация</th>
                    <th className="text-left py-3 px-2">Специализация</th>
                    <th className="text-left py-3 px-2">Телефон</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {persons.map((p: any) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-2 font-medium">{p.fullName}</td>
                      <td className="py-3 px-2">
                        <Badge variant="info">{PERSON_TYPE_LABEL[p.personType] || p.personType}</Badge>
                      </td>
                      <td className="py-3 px-2 text-slate-400">{p.organization?.name || '—'}</td>
                      <td className="py-3 px-2 text-slate-400">{p.specialization || '—'}</td>
                      <td className="py-3 px-2 text-slate-400">{p.phone || '—'}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)} title="Редактировать">
                            <Pencil size={14} />
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => { if (confirm('Удалить?')) deleteMut.mutate(p.id); }} title="Удалить">
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Редактировать персону' : 'Создать персону'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Имя *" value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} required />
          <Select label="Тип *" value={form.personType} onChange={(e) => setForm(f => ({ ...f, personType: e.target.value }))} options={PERSON_TYPE_OPTIONS.filter(o => o.value)} />
          <Select label="Организация" value={form.organizationId} onChange={(e) => setForm(f => ({ ...f, organizationId: e.target.value }))} options={orgOptions.filter(o => o.value)} />
          <Input label="Специализация" value={form.specialization} onChange={(e) => setForm(f => ({ ...f, specialization: e.target.value }))} />
          <Input label="Телефон" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Bio" value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Отмена</Button>
            <Button variant="primary" type="submit" loading={createMut.isPending}>Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
