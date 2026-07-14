import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth, ROLES } from '../context/AuthContext';
import { useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState, Textarea } from '../components/ui/BaseComponents';
import { T, VISIBILITY_OPTIONS } from '../utils/constants';

const ROLE_OPTIONS = [
  { value: 'doctor',    label: '👨‍⚕️ Врач' },
  { value: 'assistant', label: '🤝 Ассистент' },
  { value: 'admin',     label: '💼 Администратор' },
  { value: 'director',  label: '👔 Руководитель' },
];

const ROLE_COLORS = {
  director:  T.gold,
  admin:     T.sapphire,
  doctor:    T.emerald,
  assistant: T.teal,
};

const ROLE_LABELS = {
  director:  'Руководитель',
  admin:     'Администратор',
  doctor:    'Врач',
  assistant: 'Ассистент',
};

const SPECS = [
  { value: '',              label: '— Без специализации —' },
  { value: 'Терапевт',      label: 'Терапевт' },
  { value: 'Ортопед',       label: 'Ортопед' },
  { value: 'Хирург',        label: 'Хирург' },
  { value: 'Ортодонт',      label: 'Ортодонт' },
  { value: 'Пародонтолог',  label: 'Пародонтолог' },
  { value: 'Детский стоматолог', label: 'Детский стоматолог' },
  { value: 'Имплантолог',   label: 'Имплантолог' },
  { value: 'Ассистент',     label: 'Ассистент' },
  { value: 'Администратор', label: 'Администратор' },
];

const EMPTY_FORM = {
  name: '', login: '', password: '', role: 'doctor', spec: '', phone: '',
  email: '', bio: '', photoUrl: '', visibility: 'public', experienceYears: 0,
};

export default function Staff() {
  const { clinic, user } = useOutletContext();
  const { getClinicStaff, addStaffMember, roleInfo } = useAuth();
  const { toast, showToast, clearToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [profileModal, setProfileModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState('all');
  const [editingStaff, setEditingStaff] = useState(null);

  const staff = getClinicStaff(clinic?.id || user?.clinicId);
  const filtered = filter === 'all' ? staff : staff.filter(s => s.role === filter);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.login || !form.password) {
      showToast('Заполните все обязательные поля', 'warning');
      return;
    }
    if (form.password.length < 6) {
      showToast('Пароль должен быть не менее 6 символов', 'warning');
      return;
    }
    const result = addStaffMember({
      ...form,
      workSchedule: form.role === 'doctor' ? form.workSchedule : undefined,
      clinicId: clinic?.id || user?.clinicId,
      experienceYears: Number(form.experienceYears) || 0,
    });
    if (result === false) {
      showToast('Такой логин уже занят', 'error');
      return;
    }
    showToast(`${ROLE_LABELS[form.role] || 'Сотрудник'} добавлен`, 'success');
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setEditingStaff(null);
  };

  const openEditStaff = (member) => {
    setEditingStaff(member);
    setForm({
      name: member.name || '',
      login: member.login || '',
      password: '',
      role: member.role || 'doctor',
      spec: member.spec || '',
      phone: member.phone || '',
      email: member.email || '',
      bio: member.bio || '',
      photoUrl: member.photoUrl || '',
      visibility: member.visibility || 'public',
      experienceYears: member.experienceYears || 0,
      workSchedule: member.workSchedule || { start: '09:00', end: '18:00', workDays: ['пн', 'вт', 'ср', 'чт', 'пт'] },
    });
    setModalOpen(true);
  };

  const canManage = roleInfo?.canAddStaff;

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>
            Сотрудники
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>
            {clinic?.name} · {staff.length} чел.
          </p>
        </div>
        {canManage && <PBtn onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}>+ Добавить сотрудника</PBtn>}
      </div>

      {/* Role counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 22 }}>
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = staff.filter(s => s.role === role).length;
          return (
            <button key={role} onClick={() => setFilter(filter === role ? 'all' : role)} style={{
              background: filter === role ? `${ROLE_COLORS[role]}18` : T.card,
              border: `1px solid ${filter === role ? ROLE_COLORS[role] + '50' : T.borderSub}`,
              borderRadius: 11, padding: '14px', textAlign: 'center', cursor: 'pointer',
              transition: 'all .12s', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: ROLE_COLORS[role] }}>{count}</div>
              <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{label}</div>
            </button>
          );
        })}
      </div>

      {/* Staff grid */}
      {filtered.length === 0 ? (
        <EmptyState icon="👥" text="Нет сотрудников" sub={canManage ? 'Добавьте первого сотрудника' : 'Нет данных'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(member => {
            const roleColor = ROLE_COLORS[member.role] || T.slate;
            const isCurrentUser = member.id === user?.id;
            return (
              <Card key={member.id} style={{ position: 'relative' }} onClick={() => setProfileModal(member)}>
                {isCurrentUser && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 10, color: T.gold, background: `${T.gold}15`,
                    border: `1px solid ${T.gold}30`, borderRadius: 6, padding: '2px 7px', fontWeight: 700,
                  }}>
                    Вы
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  {/* Photo or avatar */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: `${roleColor}18`, border: `2px solid ${roleColor}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>
                    {member.photoUrl ? (
                      <img src={member.photoUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      ROLES[member.role]?.icon || '👤'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 3 }}>
                      {member.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge color={roleColor} size="sm">{ROLE_LABELS[member.role] || member.role}</Badge>
                      {member.visibility === 'private' && (
                        <Badge color={T.amber} size="sm">🔒 Приватный</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: T.slateL }}>
                  {member.spec && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: T.slate }}>🏥</span>
                      {member.spec}
                    </div>
                  )}
                  {member.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: T.slate }}>✉️</span>
                      {member.email}
                    </div>
                  )}
                  {member.experienceYears > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: T.slate }}>📅</span>
                      Стаж: {member.experienceYears} {member.experienceYears === 1 ? 'год' : member.experienceYears < 5 ? 'года' : 'лет'}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: T.slate }}>🔑</span>
                    <span style={{ fontFamily: 'monospace', color: T.slateL }}>{member.login}</span>
                  </div>
                  {member.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: T.slate }}>📞</span>
                      {member.phone}
                    </div>
                  )}
                </div>

                {member.bio && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', fontSize: 12, color: T.slateL, lineHeight: 1.5,
                    background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${T.borderSub}`,
                  }}>
                    {member.bio.length > 120 ? member.bio.slice(0, 120) + '...' : member.bio}
                  </div>
                )}

                {/* Role access summary */}
                <div style={{
                  marginTop: 12, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${T.borderSub}`, borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10, color: T.slate, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Доступ
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(ROLES[member.role]?.pages || []).map(p => {
                      const nav = { dashboard: '📊', schedule: '📅', patients: '🦷', cashier: '💰', lab: '🔬', ai: '🤖', staff: '👥', admin: '⚙️', promotions: '🎯', inventory: '📦' };
                      return (
                        <span key={p} style={{ fontSize: 14 }} title={p}>{nav[p] || p}</span>
                      );
                    })}
                  </div>
                </div>

                {canManage && (
                  <button onClick={(e) => { e.stopPropagation(); openEditStaff(member); }} style={{
                    marginTop: 10, width: '100%', padding: '7px 0', fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderSub}`, borderRadius: 7,
                    color: T.slateL, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                  }}>
                    ✏️ Редактировать
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Profile Detail Modal */}
      {profileModal && (
        <Modal title="Профиль сотрудника" onClose={() => setProfileModal(null)} size="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
              background: `${ROLE_COLORS[profileModal.role] || T.slate}18`,
              border: `3px solid ${ROLE_COLORS[profileModal.role] || T.slate}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              {profileModal.photoUrl ? (
                <img src={profileModal.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                ROLES[profileModal.role]?.icon || '👤'
              )}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.white }}>{profileModal.name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <Badge color={ROLE_COLORS[profileModal.role]}>{ROLE_LABELS[profileModal.role]}</Badge>
                {profileModal.spec && <Badge color={T.sapphire}>{profileModal.spec}</Badge>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: T.slateL }}>
            {profileModal.phone && <div><span style={{ color: T.slate }}>📞</span> {profileModal.phone}</div>}
            {profileModal.email && <div><span style={{ color: T.slate }}>✉️</span> {profileModal.email}</div>}
            {profileModal.experienceYears > 0 && (
              <div><span style={{ color: T.slate }}>📅</span> Стаж: {profileModal.experienceYears} лет</div>
            )}
            {profileModal.bio && (
              <div style={{ marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, lineHeight: 1.6 }}>
                {profileModal.bio}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            {canManage && (
              <PBtn onClick={() => { setProfileModal(null); openEditStaff(profileModal); }} style={{ flex: 1 }}>
                ✏️ Редактировать
              </PBtn>
            )}
            <GBtn onClick={() => setProfileModal(null)}>Закрыть</GBtn>
          </div>
        </Modal>
      )}

      {/* Add/Edit Staff Modal */}
      {modalOpen && (
        <Modal title={editingStaff ? 'Редактировать сотрудника' : 'Добавить сотрудника'} onClose={() => setModalOpen(false)} size="lg">
          <form onSubmit={handleSubmit}>
            <Input label="ФИО *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Иванова Мария Сергеевна" required />

            <Select label="Роль *" value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              options={ROLE_OPTIONS} />

            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: `${ROLE_COLORS[form.role] || T.slate}10`,
              border: `1px solid ${ROLE_COLORS[form.role] || T.slate}25`,
              borderRadius: 8, fontSize: 12, color: T.slateL,
            }}>
              {form.role === 'director' && '👔 Полный доступ: Dashboard, расписание, пациенты, финансы, лаборатория, AI, персонал. Видит зарплаты и расходы.'}
              {form.role === 'admin' && '💼 Доступ: расписание, пациенты, касса, лаборатория. Не видит зарплаты и подробную аналитику.'}
              {form.role === 'doctor' && '👨‍⚕️ Доступ: своё расписание, пациенты, лаборатория, AI. Видит только свои записи.'}
              {form.role === 'assistant' && '🤝 Ограниченный доступ: расписание (только просмотр), базовая информация о пациентах. Не может редактировать данные.'}
            </div>

            {(form.role === 'doctor' || form.role === 'assistant') && (
              <Select label="Специализация" value={form.spec}
                onChange={e => setForm({ ...form, spec: e.target.value })}
                options={SPECS} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Телефон" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 777 000 00 00" />
              <Input label="Email" type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="doctor@clinic.kz" />
            </div>

            {form.role === 'doctor' && (
              <Input label="Стаж (лет)" type="number" min="0" max="60" value={form.experienceYears}
                onChange={e => setForm({ ...form, experienceYears: e.target.value })} />
            )}

            {form.role === 'doctor' && (
              <Textarea label="О себе (био)" value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Расскажите о себе, образовании, опыте работы..." rows={3} />
            )}

            {form.role === 'doctor' && (
              <Select label="Видимость профиля" value={form.visibility}
                onChange={e => setForm({ ...form, visibility: e.target.value })}
                options={VISIBILITY_OPTIONS} />
            )}

            {form.role === 'doctor' && (
              <Input label="Фото URL" value={form.photoUrl}
                onChange={e => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg" />
            )}

            {/* График работы для врачей */}
            {form.role === 'doctor' && (
              <div style={{
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.borderSub}`,
                borderRadius: 8,
                marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, color: T.slate, marginBottom: 8, fontWeight: 600 }}>📅 График работы врача</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input
                    label="Начало рабочего дня"
                    type="time"
                    value={form.workSchedule?.start || '09:00'}
                    onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule, start: e.target.value } })}
                  />
                  <Input
                    label="Конец рабочего дня"
                    type="time"
                    value={form.workSchedule?.end || '18:00'}
                    onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule, end: e.target.value } })}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: T.slate }}>
                  Рабочие дни:
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(day => {
                      const isSelected = (form.workSchedule?.workDays || ['пн', 'вт', 'ср', 'чт', 'пт']).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = form.workSchedule?.workDays || ['пн', 'вт', 'ср', 'чт', 'пт'];
                            const updated = isSelected ? current.filter(d => d !== day) : [...current, day];
                            setForm({ ...form, workSchedule: { ...form.workSchedule, workDays: updated } });
                          }}
                          style={{
                            padding: '4px 8px', fontSize: 11, borderRadius: 4, fontFamily: 'inherit',
                            border: `1px solid ${isSelected ? T.gold : T.borderSub}`,
                            background: isSelected ? `${T.gold}20` : 'transparent',
                            color: isSelected ? T.gold : T.slate,
                            cursor: 'pointer',
                          }}
                        >
                          {day.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${T.borderSub}`, paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: T.slate, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Данные для входа
              </div>
              <Input label="Логин *" value={form.login}
                onChange={e => setForm({ ...form, login: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="doctor_name" hint="Только латиница, цифры, _ (мин. 4 символа)" required />
              {!editingStaff && (
                <Input label="Пароль *" type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Минимум 6 символов" required />
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>{editingStaff ? 'Сохранить' : 'Добавить сотрудника'}</PBtn>
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
