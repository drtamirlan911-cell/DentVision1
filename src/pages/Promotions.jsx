import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState, Textarea } from '../components/ui/BaseComponents';
import { T, gid, today, ALL_SERVICES } from '../utils/constants';
import { useData } from '../hooks/useData';

const EMPTY_FORM = {
  title: '',
  description: '',
  discountPercent: 0,
  serviceIds: [],
  startDate: today(),
  endDate: '',
  active: true,
};

export default function Promotions() {
  const { clinic } = useOutletContext();
  const { showToast, toast, clearToast } = useToast();
  const { promotions, upsertPromotion } = useData(clinic?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return promotions;
    if (filter === 'active') return promotions.filter(p => p.active && (!p.endDate || p.endDate >= today()));
    if (filter === 'inactive') return promotions.filter(p => !p.active);
    if (filter === 'expired') return promotions.filter(p => p.endDate && p.endDate < today());
    return promotions;
  }, [promotions, filter]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Введите название акции', 'warning');
      return;
    }
    upsertPromotion({
      ...form,
      id: editing?.id || gid(),
      clinicId: clinic?.id,
      discountPercent: Number(form.discountPercent) || 0,
      serviceIds: form.serviceIds || [],
    });
    showToast(editing ? 'Акция обновлена' : 'Акция создана', 'success');
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const openEdit = (promo) => {
    setEditing(promo);
    setForm({
      title: promo.title || '',
      description: promo.description || '',
      discountPercent: promo.discountPercent || 0,
      serviceIds: promo.serviceIds || [],
      startDate: promo.startDate || today(),
      endDate: promo.endDate || '',
      active: promo.active !== false,
    });
    setModalOpen(true);
  };

  const toggleService = (serviceId) => {
    setForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }));
  };

  const stats = useMemo(() => ({
    total: promotions.length,
    active: promotions.filter(p => p.active && (!p.endDate || p.endDate >= today())).length,
    expired: promotions.filter(p => p.endDate && p.endDate < today()).length,
  }), [promotions]);

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>
            Акции и промоции
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>
            {clinic?.name} · {stats.active} активных
          </p>
        </div>
        <PBtn onClick={() => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true); }}>+ Новая акция</PBtn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Всего', value: stats.total, color: T.slateL },
          { label: 'Активных', value: stats.active, color: T.emerald },
          { label: 'Истёкших', value: stats.expired, color: T.ruby },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'Все' },
          { key: 'active', label: 'Активные' },
          { key: 'inactive', label: 'Неактивные' },
          { key: 'expired', label: 'Истёкшие' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', fontFamily: 'inherit',
            background: filter === f.key ? `${T.gold}20` : T.card,
            color: filter === f.key ? T.gold : T.slate,
            border: `1px solid ${filter === f.key ? T.gold + '40' : T.borderSub}`,
            cursor: 'pointer',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Promotions grid */}
      {filtered.length === 0 ? (
        <EmptyState icon="🎯" text="Нет акций" sub="Создайте первую промоцию" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filtered.map(promo => {
            const isExpired = promo.endDate && promo.endDate < today();
            const statusColor = isExpired ? T.ruby : promo.active ? T.emerald : T.slate;
            return (
              <Card key={promo.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => openEdit(promo)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>🎯</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{promo.title}</span>
                    </div>
                    {promo.discountPercent > 0 && (
                      <div style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 8,
                        background: `${T.ruby}15`, color: T.ruby, fontSize: 13, fontWeight: 700, marginBottom: 6,
                      }}>
                        -{promo.discountPercent}%
                      </div>
                    )}
                  </div>
                  <Badge color={statusColor} size="sm">
                    {isExpired ? 'Истекла' : promo.active ? 'Активна' : 'Неактивна'}
                  </Badge>
                </div>
                {promo.description && (
                  <p style={{ fontSize: 12, color: T.slateL, marginBottom: 8, lineHeight: 1.5 }}>{promo.description}</p>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.slate }}>
                  {promo.startDate && <span>С {promo.startDate}</span>}
                  {promo.endDate && <span>До {promo.endDate}</span>}
                  {promo.serviceIds?.length > 0 && <span>{promo.serviceIds.length} услуг</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal title={editing ? 'Редактировать акцию' : 'Новая акция'} onClose={() => setModalOpen(false)} size="md">
          <form onSubmit={handleSubmit}>
            <Input label="Название *" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Скидка на отбеливание" required />

            <Textarea label="Описание" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Подробное описание акции..." rows={3} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Скидка (%)" type="number" min="0" max="100" value={form.discountPercent}
                onChange={e => setForm({ ...form, discountPercent: e.target.value })} />
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: T.slateL }}>
                  <input type="checkbox" checked={form.active}
                    onChange={e => setForm({ ...form, active: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: T.gold }} />
                  Активна
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Дата начала" type="date" value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })} />
              <Input label="Дата окончания" type="date" value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 8 }}>Услуги (акция на)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_SERVICES.slice(0, 14).map(s => {
                  const selected = form.serviceIds?.includes(s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleService(s.id)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                      background: selected ? `${T.gold}20` : 'rgba(255,255,255,0.04)',
                      color: selected ? T.gold : T.slate,
                      border: `1px solid ${selected ? T.gold + '40' : T.borderSub}`,
                    }}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>{editing ? 'Сохранить' : 'Создать'}</PBtn>
              <GBtn onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
