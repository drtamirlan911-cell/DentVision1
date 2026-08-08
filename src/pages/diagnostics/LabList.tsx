import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Search, MapPin, Phone, Edit2, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useAuth } from '@/store/auth.store';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

export default function LabList() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '' });

  const isSuperAdmin = role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.labs(search),
    queryFn: () => api.getDiagnosticLaboratories(search),
  });

  const labs = data?.data || data || [];

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editItem
        ? api.updateDiagnosticLaboratory(editItem.id, data)
        : api.createDiagnosticLaboratory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.labs() });
      setShowModal(false);
      setEditItem(null);
      setForm({ name: '', city: '', address: '', phone: '', email: '' });
    },
  });

  const openEdit = (c: any) => {
    setEditItem(c);
    setForm({ name: c.name, city: c.city || '', address: c.address || '', phone: c.phone || '', email: c.email || '' });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', city: '', address: '', phone: '', email: '' });
    setShowModal(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Лаборатории</h1>
          <p className="text-sm text-txt-muted mt-0.5">Все лаборатории в системе</p>
        </div>
        {isSuperAdmin && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate} className="min-h-11">
            Добавить лабораторию
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 min-h-11 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : labs.length === 0 ? (
        <GlassCard padding="md">
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
            <FlaskConical size={48} className="opacity-20" />
            {search ? 'Ничего не найдено' : 'Нет лабораторий'}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {labs.map((c: any) => (
            <GlassCard key={c.id} padding="md" hover>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dv-gold/10 flex items-center justify-center">
                    <FlaskConical size={20} className="text-dv-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-txt-primary">{c.name}</p>
                    <p className="text-xs text-txt-muted flex items-center gap-1"><MapPin size={12} />{c.city || '—'}</p>
                  </div>
                </div>
                {isSuperAdmin && (
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-surface-1 text-txt-muted hover:text-dv-gold transition-colors">
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-1 text-xs text-txt-muted">
                {c.address && <p>{c.address}</p>}
                {c.phone && <p className="flex items-center gap-1"><Phone size={12} />{c.phone}</p>}
              </div>
              <div className="mt-3 text-xs text-txt-muted">
                Тестов: {c._count?.tests ?? 0}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <Card padding="lg" className="w-full max-w-full sm:max-w-md mx-4 max-h-[85vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-txt-primary">{editItem ? 'Редактировать лабораторию' : 'Добавить лабораторию'}</h3>
              <button aria-label="Close" onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-surface-1 text-txt-muted"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Название *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 min-h-11 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Город</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 min-h-11 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Адрес</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 min-h-11 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Телефон</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 min-h-11 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 min-h-11 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setShowModal(false)} className="min-h-11">Отмена</Button>
              <Button variant="primary" onClick={() => saveMutation.mutate(form)} className="min-h-11"
                disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? 'Сохранение...' : editItem ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
