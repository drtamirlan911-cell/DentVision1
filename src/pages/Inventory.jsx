import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast, useData } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, gid, today, INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../utils/constants';

const EMPTY_FORM = {
  name: '',
  quantity: 0,
  unit: 'шт',
  minQuantity: 0,
  category: '',
  supplier: '',
  cost: 0,
  expiryDate: '',
};

export default function Inventory() {
  const { clinic } = useOutletContext();
  const { showToast, toast, clearToast } = useToast();
  const { inventory, upsertInventoryItem } = useData(clinic?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const stats = useMemo(() => ({
    total: inventory.length,
    lowStock: inventory.filter(i => i.quantity <= (i.minQuantity || i.min || 0) && (i.minQuantity || i.min || 0) > 0).length,
    totalValue: inventory.reduce((sum, i) => sum + ((i.cost || 0) * (i.quantity || 0)), 0),
  }), [inventory]);

  const filtered = useMemo(() => {
    let items = [...inventory];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      );
    }
    if (filter === 'lowStock') {
      items = items.filter(i => i.quantity <= (i.minQuantity || i.min || 0) && (i.minQuantity || i.min || 0) > 0);
    }
    if (filter === 'expiring') {
      const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      items = items.filter(i => i.expiryDate && i.expiryDate <= weekFromNow);
    }
    items.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'quantity') return (a.quantity || 0) - (b.quantity || 0);
      if (sortBy === 'cost') return ((b.cost || 0) * (b.quantity || 0)) - ((a.cost || 0) * (a.quantity || 0));
      return 0;
    });
    return items;
  }, [inventory, search, filter, sortBy]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Введите название', 'warning');
      return;
    }
    upsertInventoryItem({
      ...form,
      id: editing?.id || gid(),
      clinicId: clinic?.id,
      quantity: Number(form.quantity) || 0,
      minQuantity: Number(form.minQuantity) || 0,
      cost: Number(form.cost) || 0,
    });
    showToast(editing ? 'Товар обновлён' : 'Товар добавлен', 'success');
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      quantity: item.quantity || 0,
      unit: item.unit || 'шт',
      minQuantity: item.minQuantity || item.min || 0,
      category: item.category || '',
      supplier: item.supplier || '',
      cost: item.cost || 0,
      expiryDate: item.expiryDate || '',
    });
    setModalOpen(true);
  };

  const quickAdjust = (item, delta) => {
    const newQty = Math.max(0, (item.quantity || 0) + delta);
    upsertInventoryItem({ ...item, quantity: newQty, clinicId: clinic?.id });
  };

  const getStockColor = (item) => {
    const min = item.minQuantity || item.min || 0;
    if (min > 0 && item.quantity <= min) return T.ruby;
    if (min > 0 && item.quantity <= min * 1.5) return T.amber;
    return T.emerald;
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>
            Склад
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>
            {clinic?.name} · {stats.total} позиций
          </p>
        </div>
        <PBtn onClick={() => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true); }}>+ Добавить товар</PBtn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Всего позиций', value: stats.total, color: T.slateL },
          { label: 'Мало на складе', value: stats.lowStock, color: T.ruby },
          { label: 'Общая стоимость', value: `${(stats.totalValue / 1000).toFixed(0)}K ₸`, color: T.gold },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..."
          style={{
            flex: '1 1 200px', maxWidth: 300,
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.white, outline: 'none', fontFamily: 'inherit',
          }}
        />
        {[
          { key: 'all', label: 'Все' },
          { key: 'lowStock', label: 'Мало' },
          { key: 'expiring', label: 'Истекает' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: filter === f.key ? `${T.gold}20` : T.card,
            color: filter === f.key ? T.gold : T.slate,
            border: `1px solid ${filter === f.key ? T.gold + '40' : T.borderSub}`,
            cursor: 'pointer',
          }}>
            {f.label}
          </button>
        ))}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 12, background: T.card,
          border: `1px solid ${T.borderSub}`, color: T.slateL, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <option value="name">По названию</option>
          <option value="quantity">По количеству</option>
          <option value="cost">По стоимости</option>
        </select>
      </div>

      {/* Inventory list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📦" text="Склад пуст" sub="Добавьте первый товар" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(item => {
            const stockColor = getStockColor(item);
            const min = item.minQuantity || item.min || 0;
            const isLow = min > 0 && item.quantity <= min;
            return (
              <Card key={item.id} style={{ position: 'relative' }} onClick={() => openEdit(item)}>
                {isLow && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 10, color: T.ruby, background: `${T.ruby}15`,
                    border: `1px solid ${T.ruby}30`, borderRadius: 6, padding: '2px 7px', fontWeight: 700,
                  }}>
                    МАЛО
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 4 }}>{item.name}</div>
                    {item.category && (
                      <Badge color={T.sapphire} size="sm">{item.category}</Badge>
                    )}
                  </div>
                </div>

                {/* Stock bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: T.slate }}>Остаток</span>
                    <span style={{ color: stockColor, fontWeight: 700 }}>
                      {item.quantity} {item.unit || 'шт'}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: stockColor,
                      width: `${min > 0 ? Math.min(100, (item.quantity / (min * 2)) * 100) : 50}%`,
                      transition: 'width .3s',
                    }} />
                  </div>
                  {min > 0 && (
                    <div style={{ fontSize: 10, color: T.slate, marginTop: 2 }}>Мин: {min} {item.unit || 'шт'}</div>
                  )}
                </div>

                {/* Quick adjust buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => quickAdjust(item, -1)} style={{
                    flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${T.ruby}30`,
                    background: `${T.ruby}10`, color: T.ruby, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}>-1</button>
                  <button onClick={() => quickAdjust(item, 1)} style={{
                    flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${T.emerald}30`,
                    background: `${T.emerald}10`, color: T.emerald, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}>+1</button>
                  <button onClick={() => quickAdjust(item, 10)} style={{
                    flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${T.emerald}30`,
                    background: `${T.emerald}10`, color: T.emerald, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}>+10</button>
                </div>

                {item.supplier && (
                  <div style={{ fontSize: 11, color: T.slate, marginTop: 8 }}>
                    Поставщик: {item.supplier}
                  </div>
                )}
                {item.expiryDate && (
                  <div style={{ fontSize: 11, color: new Date(item.expiryDate) < new Date() ? T.ruby : T.slate, marginTop: 4 }}>
                    Годен до: {item.expiryDate}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal title={editing ? 'Редактировать товар' : 'Добавить товар'} onClose={() => setModalOpen(false)} size="md">
          <form onSubmit={handleSubmit}>
            <Input label="Название *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Пломбировочный материал" required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Input label="Кол-во" type="number" min="0" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
              <Select label="Ед. изм." value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                options={INVENTORY_UNITS} />
              <Input label="Мин. кол-во" type="number" min="0" value={form.minQuantity}
                onChange={e => setForm({ ...form, minQuantity: e.target.value })} />
            </div>

            <Select label="Категория" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              options={[{ value: '', label: '— Без категории —' }, ...INVENTORY_CATEGORIES.map(c => ({ value: c, label: c }))]} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Цена за ед. (₸)" type="number" min="0" value={form.cost}
                onChange={e => setForm({ ...form, cost: e.target.value })} />
              <Input label="Годен до" type="date" value={form.expiryDate}
                onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
            </div>

            <Input label="Поставщик" value={form.supplier}
              onChange={e => setForm({ ...form, supplier: e.target.value })}
              placeholder="Название компании" />

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>{editing ? 'Сохранить' : 'Добавить'}</PBtn>
              <GBtn onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
