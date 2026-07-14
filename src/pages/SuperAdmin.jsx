import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, StatCard, Toast } from '../components/ui/BaseComponents';
import { T, PLANS, tg, gid, fd } from '../utils/constants';

const PLAN_COLORS = { starter: T.sapphire, pro: T.gold, enterprise: T.purple };

export default function SuperAdmin() {
  const { user } = useOutletContext();
  const { allClinics, allUsers } = useAuth();
  const { toast, showToast, clearToast } = useToast();
  
  const [clinics, setClinics] = useState(allClinics);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClinic, setEditClinic] = useState(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '', plan: 'starter', active: true });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState(null);

  const users = allUsers;

  const openNew = () => {
    setEditClinic(null);
    setForm({ name: '', city: '', address: '', phone: '', email: '', plan: 'starter', active: true });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditClinic(c);
    setForm({ name: c.name, city: c.city || '', address: c.address || '', phone: c.phone || '', email: c.email || '', plan: c.plan || 'starter', active: c.active });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Введите название клиники', 'warning'); return; }
    if (editClinic) {
      setClinics(prev => prev.map(c => c.id === editClinic.id ? { ...c, ...form } : c));
      showToast('Клиника обновлена', 'success');
    } else {
      const newClinic = { ...form, id: gid(), createdAt: new Date().toISOString().slice(0, 10), color: T.gold, subscriptionStart: new Date().toISOString().slice(0, 10), subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) };
      setClinics(prev => [...prev, newClinic]);
      showToast('Клиника добавлена', 'success');
    }
    setModalOpen(false);
  };

  const toggleActive = (id) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    showToast('Статус обновлён', 'info');
  };

  const changePlan = (clinicId, newPlan) => {
    setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, plan: newPlan } : c));
    showToast('Тариф изменён', 'success');
  };

  const extendSubscription = (clinicId, months = 1) => {
    setClinics(prev => prev.map(c => {
      if (c.id === clinicId) {
        const currentEnd = c.subscriptionEnd ? new Date(c.subscriptionEnd) : new Date();
        const newEnd = new Date(currentEnd.setMonth(currentEnd.getMonth() + months));
        return { ...c, subscriptionEnd: newEnd.toISOString().slice(0, 10) };
      }
      return c;
    }));
    showToast(`Подписка продлена на ${months} мес.`, 'success');
  };

  const openResetPassword = (u) => {
    setResetUser(u);
    setNewPassword('');
    setResetModalOpen(true);
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { showToast('Пароль должен быть не менее 6 символов', 'warning'); return; }
    showToast(`Пароль для ${resetUser.login} сброшен`, 'success');
    setResetModalOpen(false);
  };

  const openDelete = (c) => {
    setClinicToDelete(c);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (clinicToDelete) {
      setClinics(prev => prev.filter(c => c.id !== clinicToDelete.id));
      showToast('Клиника удалена', 'success');
      setDeleteModalOpen(false);
      setClinicToDelete(null);
    }
  };

  const stats = {
    total: clinics.length,
    active: clinics.filter(c => c.active).length,
    blocked: clinics.filter(c => !c.active).length,
    users: users.length,
    revenue: clinics.reduce((s, c) => s + (c.plan === 'enterprise' ? 150000 : c.plan === 'pro' ? 35000 : 15000), 0),
    expiringSoon: clinics.filter(c => {
      if (!c.subscriptionEnd) return false;
      const endDate = new Date(c.subscriptionEnd);
      const now = new Date();
      const daysLeft = (endDate - now) / (1000 * 60 * 60 * 24);
      return daysLeft <= 7 && daysLeft >= 0;
    }).length,
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>🏢 Управление SaaS</h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>DentVision Platform · {user?.name}</p>
        </div>
        <PBtn onClick={openNew}>+ Добавить клинику</PBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard title="Всего клиник" value={stats.total} icon="🏥" color={T.white} />
        <StatCard title="Активных" value={stats.active} icon="✅" color={T.emerald} />
        <StatCard title="Заблокировано" value={stats.blocked} icon="🚫" color={T.ruby} />
        <StatCard title="Истекают (7 дн.)" value={stats.expiringSoon} icon="⚠️" color={T.amber} />
        <StatCard title="Пользователей" value={stats.users} icon="👥" color={T.sapphire} />
        <StatCard title="MRR" value={tg(stats.revenue)} icon="💰" color={T.gold} />
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Клиника</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Контакты</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Тариф</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Подписка</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Статус</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map(c => {
                const clinicUsers = users.filter(u => u.clinicId === c.id);
                const endDate = c.subscriptionEnd ? new Date(c.subscriptionEnd) : null;
                const daysLeft = endDate ? Math.floor((endDate - new Date()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                const isExpired = daysLeft !== null && daysLeft < 0;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSub}50` }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: T.slate }}>Город: {c.city || '—'}</div>
                      <div style={{ fontSize: 11, color: T.slate }}>Сотрудников: {clinicUsers.length}</div>
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>
                      <div>{c.phone || '—'}</div>
                      <div>{c.email || '—'}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Badge color={PLAN_COLORS[c.plan] || T.slate} size="sm">{PLANS[c.plan]?.name || c.plan}</Badge>
                      <div style={{ marginTop: 6 }}>
                        <Select value={c.plan} onChange={(e) => changePlan(c.id, e.target.value)} options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: v.name }))} style={{ fontSize: 10, padding: '4px 6px', width: 'auto', minWidth: 100 }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {endDate && (<div>
                        <div style={{ fontSize: 11, color: isExpired ? T.ruby : isExpiring ? T.amber : T.slate, marginBottom: 4 }}>{isExpired ? '⛔ Истекла' : isExpiring ? `⚠️ ${daysLeft} дн.` : `✓ ${daysLeft} дн.`}</div>
                        <div style={{ fontSize: 10, color: T.slate, marginBottom: 4 }}>{fd(c.subscriptionEnd)}</div>
                        <GBtn size="sm" onClick={() => extendSubscription(c.id, 1)}>+1 мес.</GBtn>
                        <GBtn size="sm" onClick={() => extendSubscription(c.id, 3)} style={{ marginLeft: 4 }}>+3 мес.</GBtn>
                      </div>)}
                      {!endDate && <span style={{ fontSize: 11, color: T.slate }}>—</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Badge color={c.active ? T.emerald : T.ruby} size="sm">{c.active ? '✓ Активна' : '✕ Заблокирована'}</Badge>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <GBtn size="sm" onClick={() => openEdit(c)} title="Редактировать">✏️</GBtn>
                        <GBtn size="sm" color={c.active ? T.ruby : T.emerald} onClick={() => toggleActive(c.id)} title={c.active ? 'Заблокировать' : 'Разблокировать'}>{c.active ? '🚫' : '✅'}</GBtn>
                        <GBtn size="sm" onClick={() => { const director = clinicUsers.find(u => u.role === 'director'); if (director) openResetPassword(director); else showToast('Нет директора у этой клиники', 'warning'); }} title="Сбросить пароль директору">🔑</GBtn>
                        <GBtn size="sm" color={T.ruby} onClick={() => openDelete(c)} title="Удалить клинику">🗑️</GBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <Modal title={editClinic ? 'Редактировать клинику' : 'Новая клиника'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <Input label="Название клиники *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Город" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
            <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Тарифный план" value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.price})` }))} />
              <Select label="Статус" value={form.active ? 'active' : 'blocked'} onChange={e => setForm({ ...form, active: e.target.value === 'active' })} options={[{ value: 'active', label: 'Активна' }, { value: 'blocked', label: 'Заблокирована' }]} />
            </div>
            <div style={{ background: `${T.gold}10`, border: `1px solid ${T.gold}30`, borderRadius: 8, padding: 12, marginTop: 12, fontSize: 12, color: T.slateL }}><strong>ℹ️ При создании:</strong> будет автоматически создан аккаунт директора с логином «admin_&lt;название&gt;» и временным паролем</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>{editClinic ? 'Сохранить' : 'Создать клинику'}</PBtn>
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}

      {resetModalOpen && resetUser && (
        <Modal title={`Сброс пароля: ${resetUser.name}`} onClose={() => setResetModalOpen(false)}>
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 16, fontSize: 13, color: T.slateL }}>Логин: <strong style={{ color: T.white, fontFamily: 'monospace' }}>{resetUser.login}</strong></div>
            <Input label="Новый пароль *" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Минимум 6 символов" required />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Сбросить пароль</PBtn>
              <GBtn type="button" onClick={() => setResetModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}

      {deleteModalOpen && clinicToDelete && (
        <Modal title="⚠️ Удаление клиники" onClose={() => setDeleteModalOpen(false)}>
          <div style={{ fontSize: 14, color: T.slateL, marginBottom: 16 }}>Вы действительно хотите удалить клинику <strong style={{ color: T.white }}>{clinicToDelete.name}</strong>?<br /><br />Это действие необратимо. Все данные клиники (пациенты, записи, сотрудники) будут удалены.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PBtn onClick={handleDelete} style={{ flex: 1, background: T.ruby, borderColor: T.ruby }}>Удалить</PBtn>
            <GBtn onClick={() => setDeleteModalOpen(false)}>Отмена</GBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}
