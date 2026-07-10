import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, StatCard, Toast } from '../components/ui/BaseComponents';
import { T, PLANS, tg, gid, fd } from '../utils/constants';

const TABS = [
  { id: 'clinics',       label: '🏥 Клиники' },
  { id: 'users',         label: '👥 Пользователи' },
  { id: 'subscriptions', label: '💳 Тарифы' },
];

const PLAN_COLORS = { starter: T.sapphire, pro: T.gold, enterprise: T.purple };
const ROLE_LABELS = { superadmin: 'Super Admin', director: 'Руководитель', admin: 'Администратор', doctor: 'Врач', assistant: 'Ассистент' };
const ROLE_COLORS = { superadmin: T.purple, director: T.gold, admin: T.sapphire, doctor: T.emerald, assistant: T.teal };

export default function SuperAdmin({ user }) {
  const { allClinics, allUsers, addStaffMember } = useAuth();
  const { toast, showToast, clearToast } = useToast();
  const [activeTab, setActiveTab] = useState('clinics');
  const [clinics, setClinics] = useState(allClinics);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClinic, setEditClinic] = useState(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', plan: 'starter', active: true });
  const [userSearch, setUserSearch] = useState('');

  const users = allUsers;

  const openNew = () => {
    setEditClinic(null);
    setForm({ name: '', city: '', address: '', phone: '', plan: 'starter', active: true });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditClinic(c);
    setForm({ name: c.name, city: c.city || '', address: c.address || '', phone: c.phone || '', plan: c.plan || 'starter', active: c.active });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Введите название клиники', 'warning'); return; }
    if (editClinic) {
      setClinics(prev => prev.map(c => c.id === editClinic.id ? { ...c, ...form } : c));
      showToast('Клиника обновлена', 'success');
    } else {
      const newClinic = { ...form, id: gid(), createdAt: new Date().toISOString().slice(0, 10), color: T.gold };
      setClinics(prev => [...prev, newClinic]);
      showToast('Клиника добавлена', 'success');
    }
    setModalOpen(false);
  };

  const toggleActive = (id) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    showToast('Статус обновлён', 'info');
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.login?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const stats = {
    total:   clinics.length,
    active:  clinics.filter(c => c.active).length,
    users:   users.length,
    revenue: clinics.reduce((s, c) => s + (c.plan === 'enterprise' ? 150000 : c.plan === 'pro' ? 35000 : 15000), 0),
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>⚙️ Super Admin</h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Управление всеми клиниками DentVision · {user?.name}</p>
        </div>
        <PBtn onClick={openNew}>+ Добавить клинику</PBtn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard title="Всего клиник"     value={stats.total}          icon="🏥" color={T.white} />
        <StatCard title="Активных"         value={stats.active}         icon="✅" color={T.emerald} />
        <StatCard title="Пользователей"    value={stats.users}          icon="👥" color={T.sapphire} />
        <StatCard title="MRR (SaaS доход)" value={tg(stats.revenue)}    icon="💰" color={T.gold} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '6px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: activeTab === t.id ? `${T.gold}20` : 'transparent',
            color: activeTab === t.id ? T.gold : T.slate,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Clinics */}
      {activeTab === 'clinics' && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                  {['Клиника', 'Город', 'Телефон', 'Тариф', 'Сотрудники', 'Статус', 'Регистрация', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clinics.map(c => {
                  const clinicUsers = users.filter(u => u.clinicId === c.id);
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${T.borderSub}50` }}>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: T.white }}>{c.name}</td>
                      <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>{c.city || '—'}</td>
                      <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <Badge color={PLAN_COLORS[c.plan] || T.slate} size="sm">
                          {PLANS[c.plan]?.name || c.plan}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, color: T.white, fontWeight: 600 }}>
                        {clinicUsers.length}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge color={c.active ? T.emerald : T.ruby} size="sm">
                          {c.active ? '✓ Активна' : '✕ Заблокирована'}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, color: T.slate, whiteSpace: 'nowrap' }}>{fd(c.createdAt)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <GBtn size="sm" onClick={() => openEdit(c)}>✏</GBtn>
                          <GBtn size="sm" color={c.active ? T.ruby : T.emerald} onClick={() => toggleActive(c.id)}>
                            {c.active ? '🚫' : '✅'}
                          </GBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="🔍 Поиск по имени или логину…"
              style={{
                width: '100%', maxWidth: 400,
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`,
                borderRadius: 9, padding: '9px 13px', fontSize: 13, color: T.white,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                    {['Имя', 'Логин', 'Роль', 'Специализация', 'Клиника', 'Телефон'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const clinic = clinics.find(c => c.id === u.clinicId);
                    return (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${T.borderSub}50` }}>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: T.white }}>{u.name}</td>
                        <td style={{ padding: '12px', fontSize: 12, color: T.slateL, fontFamily: 'monospace' }}>{u.login}</td>
                        <td style={{ padding: '12px' }}>
                          <Badge color={ROLE_COLORS[u.role] || T.slate} size="sm">
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>{u.spec || '—'}</td>
                        <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>{clinic?.name || '—'}</td>
                        <td style={{ padding: '12px', fontSize: 12, color: T.slateL }}>{u.phone || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {Object.entries(PLANS).map(([key, plan]) => {
            const count = clinics.filter(c => c.plan === key).length;
            const revenue = count * (key === 'enterprise' ? 150000 : key === 'pro' ? 35000 : 15000);
            return (
              <div key={key} style={{
                background: T.card, border: `1px solid ${key === 'pro' ? T.gold : T.borderSub}`,
                borderRadius: 14, padding: '24px 20px', position: 'relative',
                boxShadow: key === 'pro' ? `0 0 30px ${T.gold}10` : 'none',
              }}>
                {key === 'pro' && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: T.gold, color: T.bg, padding: '3px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    ★ Популярный
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: PLAN_COLORS[key], margin: '0 0 6px' }}>{plan.name}</h3>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.white }}>{plan.price}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: PLAN_COLORS[key] }}>{count}</div>
                      <div style={{ fontSize: 11, color: T.slate }}>клиник</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{tg(revenue)}</div>
                      <div style={{ fontSize: 11, color: T.slate }}>MRR</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.slateL }}>
                      <span style={{ color: PLAN_COLORS[key] }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal title={editClinic ? 'Редактировать клинику' : 'Новая клиника'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <Input label="Название клиники" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Город" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Тарифный план" value={form.plan}
                onChange={e => setForm({ ...form, plan: e.target.value })}
                options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: v.name }))} />
              <Select label="Статус" value={form.active ? 'active' : 'blocked'}
                onChange={e => setForm({ ...form, active: e.target.value === 'active' })}
                options={[{ value: 'active', label: 'Активна' }, { value: 'blocked', label: 'Заблокирована' }]} />
            </div>
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
