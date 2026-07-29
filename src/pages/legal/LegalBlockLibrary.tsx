import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { apiRequest } from '../../utils/api';
import { Grid, Plus, Search, Edit3, Trash2 } from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'core', label: 'Core' },
  { value: 'financial', label: 'Financial' },
  { value: 'data', label: 'Data' },
  { value: 'dispute', label: 'Dispute' },
];

const CATEGORY_BADGE: Record<string, 'gold' | 'success' | 'info' | 'warning' | 'default'> = {
  core: 'gold',
  financial: 'success',
  data: 'info',
  dispute: 'warning',
};

const CATEGORY_LABEL: Record<string, string> = {
  core: 'Core',
  financial: 'Financial',
  data: 'Data',
  dispute: 'Dispute',
};

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

interface BlockForm {
  name: string;
  category: string;
  content: string;
  variables: string;
}

const EMPTY_FORM: BlockForm = { name: '', category: 'core', content: '', variables: '' };

export default function LegalBlockLibrary() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<false | 'create' | 'edit'>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BlockForm>(EMPTY_FORM);

  const blocks = useQuery({
    queryKey: ['legal', 'blocks'],
    queryFn: () => apiRequest('/api/legal/blocks'),
    staleTime: 30_000,
  });

  const createBlock = useMutation({
    mutationFn: (data: BlockForm) => apiRequest('/api/legal/blocks', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        content: data.content,
        variables: data.variables ? data.variables.split(',').map((v: string) => v.trim()).filter(Boolean) : [],
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'blocks'] });
      toast.success('Блок создан');
      setModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания'),
  });

  const updateBlock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlockForm }) => apiRequest(`/api/legal/blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        content: data.content,
        variables: data.variables ? data.variables.split(',').map((v: string) => v.trim()).filter(Boolean) : [],
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'blocks'] });
      toast.success('Блок обновлён');
      setModal(false);
      setForm(EMPTY_FORM);
      setEditId(null);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка обновления'),
  });

  const deleteBlock = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/legal/blocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'blocks'] });
      toast.success('Блок деактивирован');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка удаления'),
  });

  const blockList: any[] = Array.isArray(blocks.data) ? blocks.data : (blocks.data?.data || []);

  const filteredList = blockList.filter((b: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(b.name || '').toLowerCase().includes(q) || String(b.category || '').toLowerCase().includes(q);
  });

  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      name: b.name || '',
      category: b.category || 'core',
      content: b.content || '',
      variables: Array.isArray(b.variables) ? b.variables.join(', ') : (b.variables || ''),
    });
    setModal('edit');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блоков..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal('create'); }}>
          Создать блок
        </Button>
      </div>

      {blocks.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<Grid size={40} />}
          title="Нет блоков"
          description={search ? 'Измените поисковый запрос' : 'Создайте первый блок'}
          action={!search ? <Button icon={<Plus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModal('create'); }}>Создать блок</Button> : undefined}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Название', 'Категория', 'Переменные', 'Активен', 'Создан', 'Действия'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.map((b: any) => (
                  <tr key={b.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-txt-primary">{b.name || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={CATEGORY_BADGE[b.category] || 'default'} size="sm">
                        {CATEGORY_LABEL[b.category] || b.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(b.variables) && b.variables.length > 0 ? b.variables.slice(0, 3).map((v: string, i: number) => (
                          <Badge key={i} variant="outline" size="xs">{v}</Badge>
                        )) : <span className="text-xs text-txt-muted">—</span>}
                        {Array.isArray(b.variables) && b.variables.length > 3 && (
                          <span className="text-xs text-txt-muted">+{b.variables.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.isActive !== false ? 'success' : 'default'} size="sm" dot>
                        {b.isActive !== false ? 'Да' : 'Нет'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-txt-muted">{fd(b.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label="Редактировать" onClick={() => openEdit(b)} title="Редактировать">
                          <Edit3 size={14} />
                        </Button>
                        {b.isActive !== false && (
                          <Button size="icon-sm" variant="ghost" aria-label="Деактивировать" onClick={() => {
                            if (confirm('Деактивировать блок?')) deleteBlock.mutate(b.id);
                          }} title="Деактивировать" loading={deleteBlock.isPending && deleteBlock.variables === b.id}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!modal} onClose={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null); }}
        title={modal === 'edit' ? 'Редактировать блок' : 'Новый блок'}>
        <form onSubmit={e => {
          e.preventDefault();
          if (!form.name.trim()) { toast.warn('Введите название'); return; }
          if (modal === 'edit' && editId) updateBlock.mutate({ id: editId, data: form });
          else createBlock.mutate(form);
        }} className="space-y-4">
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Введите название блока" />
          <Select label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={CATEGORY_OPTIONS} />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-txt-secondary">Содержимое</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Текст блока с переменными {{name}}"
              className="flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 resize-none focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 px-3 py-2 min-h-[80px]" />
          </div>
          <Input label="Переменные (через запятую)" value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} placeholder="name, date, amount" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createBlock.isPending || updateBlock.isPending}>
              {modal === 'edit' ? 'Сохранить' : 'Создать блок'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_FORM); setEditId(null); }}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
