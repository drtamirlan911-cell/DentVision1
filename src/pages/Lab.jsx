import React, { useState } from 'react';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, gid, fd, today } from '../utils/constants';

const STATUS_CFG = {
  in_progress: { label: 'В работе',  color: T.sapphire },
  ready:       { label: 'Готово',    color: T.emerald },
  delivered:   { label: 'Выдано',    color: T.gold },
  delayed:     { label: 'Просрочено',color: T.ruby },
  cancelled:   { label: 'Отменено',  color: T.slate },
};

const LAB_TYPES = [
  { value: 'crown',     label: 'Коронка' },
  { value: 'bridge',    label: 'Мост' },
  { value: 'veneer',    label: 'Винир' },
  { value: 'implant',   label: 'Имплант' },
  { value: 'denture',   label: 'Протез' },
  { value: 'nightguard',label: 'Капа' },
  { value: 'other',     label: 'Другое' },
];

const MATERIALS = [
  { value: 'ceramic',       label: 'Керамика' },
  { value: 'zirconia',      label: 'Диоксид циркония' },
  { value: 'metal_ceramic', label: 'Металлокерамика' },
  { value: 'composite',     label: 'Композит' },
  { value: 'pmma',          label: 'PMMA' },
];

const EMPTY_FORM = {
  patientName: '', doctorId: '', labType: 'crown',
  material: 'zirconia', toothNumber: '', shade: '', dueDate: '', notes: '', status: 'in_progress',
};

const TABS = [
  { id: 'active',    label: 'Активные' },
  { id: 'ready',     label: 'Готовые' },
  { id: 'completed', label: 'Завершённые' },
  { id: 'waxup',     label: '🎨 Wax-Up / Smile Design' },
];

export default function Lab({ clinic }) {
  const { labOrders, upsertLabOrder, doctors } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [activeTab, setActiveTab] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const byStatus = (statuses) => labOrders.filter(o => statuses.includes(o.status));
  const active    = byStatus(['in_progress']);
  const ready     = byStatus(['ready']);
  const completed = byStatus(['delivered', 'cancelled']);
  const delayed   = byStatus(['delayed']);

  const openNew = () => { setEditOrder(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (o) => { setEditOrder(o); setForm({ ...o }); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientName || !form.dueDate) {
      showToast('Укажите пациента и срок готовности', 'warning');
      return;
    }
    try {
      await upsertLabOrder({ ...form, id: editOrder?.id || gid(), clinicId: clinic?.id });
      showToast(editOrder ? 'Заказ обновлён' : 'Заказ создан', 'success');
      setModalOpen(false);
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const changeStatus = async (order, newStatus) => {
    await upsertLabOrder({ ...order, status: newStatus });
    showToast(`Статус изменён: ${STATUS_CFG[newStatus]?.label}`, 'success');
  };

  const displayOrders = activeTab === 'active' ? active
    : activeTab === 'ready' ? ready
    : activeTab === 'completed' ? completed
    : [];

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>Лаборатория</h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Управление лабораторными заказами</p>
        </div>
        <PBtn onClick={openNew}>+ Новый заказ</PBtn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'В работе',   value: active.length,    color: T.sapphire },
          { label: 'Готово',     value: ready.length,     color: T.emerald },
          { label: 'Завершено',  value: completed.length, color: T.gold },
          { label: 'Просрочено', value: delayed.length,   color: T.ruby },
        ].map((s, i) => (
          <div key={i} style={{
            background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11,
            padding: '14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 18,
        background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '6px',
        overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
            background: activeTab === t.id ? `${T.gold}20` : 'transparent',
            color: activeTab === t.id ? T.gold : T.slate,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      {activeTab === 'waxup' ? (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>🎨 Цифровой Wax-Up / Smile Design</div>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px', border: `2px dashed ${T.border}`, borderRadius: 12,
            cursor: 'pointer', marginBottom: 20, color: T.slate, fontSize: 13,
          }}>
            <input type="file" style={{ display: 'none' }} accept=".stl,.obj,.dcm,.png,.jpg" multiple
              onChange={() => showToast('Файл загружен для Wax-Up', 'success')} />
            <span style={{ fontSize: 40, marginBottom: 10 }}>🦷</span>
            <div style={{ fontWeight: 600, color: T.slateL, marginBottom: 4 }}>Загрузить файлы для Wax-Up</div>
            <div style={{ fontSize: 12 }}>Форматы: STL, OBJ, DICOM, PNG, JPG</div>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.borderSub}`,
                background: 'rgba(255,255,255,0.03)',
              }}>
                <div style={{
                  height: 120, background: `linear-gradient(135deg, ${T.sapphire}20, ${T.purple}20)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                }}>🦷</div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>Wax-Up #{i}</div>
                  <div style={{ fontSize: 11, color: T.slate }}>12.01.2025</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : displayOrders.length === 0 ? (
        <EmptyState
          icon="🔬"
          text={`Нет ${activeTab === 'active' ? 'активных' : activeTab === 'ready' ? 'готовых' : 'завершённых'} заказов`}
          sub={activeTab === 'active' ? 'Нажмите «+ Новый заказ» для создания' : ''}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {displayOrders.map(order => {
            const sc = STATUS_CFG[order.status] || STATUS_CFG.in_progress;
            const isOverdue = order.dueDate && new Date(order.dueDate) < new Date() && order.status !== 'delivered';
            const labTypeLabel = LAB_TYPES.find(t => t.value === order.labType)?.label || order.labType;
            const materialLabel = MATERIALS.find(m => m.value === order.material)?.label || order.material;
            return (
              <Card key={order.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{order.patientName}</div>
                    <div style={{ fontSize: 11, color: T.slate, marginTop: 2 }}>Создан {fd(order.createdAt || today())}</div>
                  </div>
                  <Badge color={sc.color} size="sm">{sc.label}</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: T.slateL, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: T.slate }}>Тип:</span>
                    <span style={{ fontWeight: 600, color: T.white }}>{labTypeLabel}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: T.slate }}>Материал:</span>
                    <span style={{ fontWeight: 600, color: T.white }}>{materialLabel}</span>
                  </div>
                  {order.toothNumber && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: T.slate }}>Зуб:</span>
                      <span style={{ fontWeight: 600, color: T.white }}>{order.toothNumber}</span>
                    </div>
                  )}
                  {order.shade && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: T.slate }}>Цвет (Shade):</span>
                      <span style={{ fontWeight: 600, color: T.gold }}>{order.shade}</span>
                    </div>
                  )}
                  {order.dueDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: T.slate }}>Срок:</span>
                      <span style={{ fontWeight: 600, color: isOverdue ? T.ruby : T.slateL }}>
                        {isOverdue ? '⚠ ' : ''}{fd(order.dueDate)}
                      </span>
                    </div>
                  )}
                </div>

                {order.notes && (
                  <div style={{
                    padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${T.borderSub}`, borderRadius: 7,
                    fontSize: 12, color: T.slate, marginBottom: 12,
                  }}>
                    📝 {order.notes}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {order.status === 'in_progress' && (
                    <PBtn size="sm" onClick={() => changeStatus(order, 'ready')}>✓ Готово</PBtn>
                  )}
                  {order.status === 'ready' && (
                    <PBtn size="sm" onClick={() => changeStatus(order, 'delivered')}>📦 Выдать</PBtn>
                  )}
                  <GBtn size="sm" onClick={() => openEdit(order)}>✏ Изменить</GBtn>
                  {order.status === 'in_progress' && (
                    <GBtn size="sm" color={T.ruby} onClick={() => changeStatus(order, 'delayed')}>⏰ Просрочено</GBtn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal title={editOrder ? 'Редактировать заказ' : 'Новый лабораторный заказ'} onClose={() => setModalOpen(false)} size="md">
          <form onSubmit={handleSubmit}>
            <Input label="Пациент" value={form.patientName}
              onChange={e => setForm({ ...form, patientName: e.target.value })}
              required placeholder="ФИО пациента" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Тип работы" value={form.labType}
                onChange={e => setForm({ ...form, labType: e.target.value })}
                options={LAB_TYPES} required />
              <Select label="Материал" value={form.material}
                onChange={e => setForm({ ...form, material: e.target.value })}
                options={MATERIALS} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Номер зуба" value={form.toothNumber}
                onChange={e => setForm({ ...form, toothNumber: e.target.value })}
                placeholder="11, 21, 36…" />
              <Input label="Цвет (Shade)" value={form.shade}
                onChange={e => setForm({ ...form, shade: e.target.value })}
                placeholder="A1, A2, B1…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Срок готовности" type="date" value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
              <Select label="Статус" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
            </div>
            <Input label="Комментарии для техника" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Особые пожелания, уточнения…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Сохранить</PBtn>
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
