import React, { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState, Textarea } from '../components/ui/BaseComponents';
import { Odontogram3D, SurfaceEditor, AutoTreatmentPlan, ToothLegend } from '../components/Odontogram3D';
import { T, TOOTH_STATUS, PATIENT_CATEGORY, calculateAge, formatPhone, fd, tg, gid, today } from '../utils/constants';

// Используем PATIENT_CATEGORY из constants вместо дублирования
const CAT_CFG = PATIENT_CATEGORY;

const EMPTY_FORM = {
  name: '', phone: '', email: '', dob: '', address: '',
  category: 'new', notes: '', teeth: {},
};

const EMPTY_PAYMENT = { amount: '', payMethod: 'cash' };

export default function Patients() {
  const { clinic } = useOutletContext();
  const { patients, appointments, upsertPatient, deletePatient } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();

  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editPatient, setEditPatient] = useState(null);
  const [teethState, setTeethState] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [photos, setPhotos] = useState([]);
  const [photoCategory, setPhotoCategory] = useState('smile');
  const [payment, setPayment] = useState(EMPTY_PAYMENT);

  const filtered = patients.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
      || p.phone?.includes(search)
      || p.email?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const openNew = () => {
    setEditPatient(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditPatient(p);
    setForm({
      name: p.name || '', phone: p.phone || '', email: p.email || '',
      dob: p.dob || '', address: p.address || '',
      category: p.category || 'regular', notes: p.notes || '', teeth: p.teeth || {},
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Введите ФИО пациента', 'warning'); return; }
    try {
      await upsertPatient({ ...form, id: editPatient?.id, clinicId: clinic?.id });
      showToast(editPatient ? 'Данные обновлены' : 'Пациент добавлен', 'success');
      setModalOpen(false);
      if (selected && selected.id === editPatient?.id) {
        setSelected(s => ({ ...s, ...form }));
      }
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const handleDelete = async () => {
    if (!editPatient) return;
    if (!window.confirm(`Удалить пациента ${editPatient.name}?`)) return;
    await deletePatient(editPatient.id);
    showToast('Пациент удалён', 'success');
    setModalOpen(false);
    if (selected?.id === editPatient.id) setSelected(null);
  };

  const handleToothClick = useCallback((toothNum) => {
    setSelectedTooth(t => t === toothNum ? null : toothNum);
  }, []);

  const handleSaveToothSurfaces = (toothNum, surfaces) => {
    const updated = { ...teethState, [toothNum]: { ...teethState[toothNum], surfaces } };
    setTeethState(updated);
    setSelectedTooth(null);
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      id: gid(),
      url: URL.createObjectURL(file),
      category: photoCategory,
      date: today(),
      name: file.name,
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const patientAppts = selected
    ? appointments.filter(a => a.patientId === selected.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  if (!selected) {
    return (
      <div style={{ padding: 24 }}>
        <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>Пациенты</h1>
            <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>База пациентов клиники · {patients.length} чел.</p>
          </div>
          <PBtn onClick={openNew}>+ Новый пациент</PBtn>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center',
          background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '12px 16px',
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Поиск по ФИО, телефону, email…"
            style={{
              flex: 1, minWidth: 200,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '9px 13px', fontSize: 13,
              color: T.white, outline: 'none', fontFamily: 'inherit',
            }}
          />
          {Object.entries({ all: 'Все', ...Object.fromEntries(Object.entries(CAT_CFG).map(([k, v]) => [k, v.l])) }).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilterCat(k)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterCat === k ? `${T.gold}20` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${filterCat === k ? T.gold : T.borderSub}`,
                color: filterCat === k ? T.gold : T.slate,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Patient grid */}
        {filtered.length === 0 ? (
          <EmptyState icon="🔍" text="Пациенты не найдены" sub="Попробуйте изменить параметры поиска" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(p => {
              const cat = CAT_CFG[p.category] || CAT_CFG.regular;
              const age = calculateAge(p.dob);
              const pAppts = appointments.filter(a => a.patientId === p.id);
              const lastAppt = pAppts.sort((a, b) => b.date.localeCompare(a.date))[0];
              return (
                <div
                  key={p.id}
                  onClick={() => { setSelected(p); setTeethState(p.teeth || {}); setActiveTab('info'); }}
                  style={{
                    background: T.card, border: `1px solid ${T.borderSub}`,
                    borderRadius: 13, padding: 18, cursor: 'pointer', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderSub; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: `${cat.color}20`, border: `2px solid ${cat.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                      }}>
                        {p.category === 'vip' ? '⭐' : '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{p.name}</div>
                        {age && <div style={{ fontSize: 11, color: T.slate }}>{age} лет</div>}
                      </div>
                    </div>
                    <Badge color={cat.color} size="sm">{cat.label}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: T.slate, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>📞 {formatPhone(p.phone) || '—'}</span>
                    {p.email && <span>✉️ {p.email}</span>}
                    <span>🦷 Визитов: {pAppts.length}{lastAppt ? ` · последний ${fd(lastAppt.date)}` : ''}</span>
                    {p.notes && <span style={{ color: T.amber + 'bb' }}>⚠ {p.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <Modal title={editPatient ? 'Редактировать пациента' : 'Новый пациент'} onClose={() => setModalOpen(false)} size="md">
            <form onSubmit={handleSubmit}>
              <Input label="ФИО" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required placeholder="+7 700 000 00 00" />
                <Input label="Дата рождения" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <Select label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                options={Object.entries(CAT_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
              <Textarea label="Заметки / анамнез / аллергии" value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                placeholder="Аллергия на лидокаин, гипертония…" />
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <PBtn type="submit" style={{ flex: 1 }}>Сохранить</PBtn>
                {editPatient && <PBtn type="button" variant="danger" onClick={handleDelete}>Удалить</PBtn>}
                <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  // ── Patient Detail ────────────────────────────────────────────────
  const cat = CAT_CFG[selected.category] || CAT_CFG.regular;
  const TABS = [
    { id: 'info',        label: 'Карта' },
    { id: 'odontogram', label: '🦷 Одонтограмма' },
    { id: 'payment',    label: '💰 Оплата' },
    { id: 'photos',     label: '📸 Фотопротокол' },
    { id: 'history',    label: '📋 История' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Back + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <GBtn onClick={() => setSelected(null)}>← К списку</GBtn>
        <div style={{ display: 'flex', gap: 8 }}>
          <PBtn onClick={() => setActiveTab('info')}>📋 План лечения</PBtn>
          <GBtn color={T.sapphire} onClick={() => openEdit(selected)}>✏ Редактировать</GBtn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }} className="grid-2">
        {/* Patient card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: `${cat.color}20`, border: `3px solid ${cat.color}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, margin: '0 auto 12px',
              }}>
                {selected.category === 'vip' ? '⭐' : '👤'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.white }}>{selected.name}</div>
              <Badge color={cat.color} size="md" style={{ marginTop: 8 }}>{cat.label}</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: T.slateL }}>
              {selected.phone && <div>📞 {formatPhone(selected.phone)}</div>}
              {selected.email && <div>✉️ {selected.email}</div>}
              {selected.dob && <div>🎂 {fd(selected.dob)} ({calculateAge(selected.dob)} лет)</div>}
              {selected.address && <div>📍 {selected.address}</div>}
              {selected.notes && (
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: `${T.amber}10`, border: `1px solid ${T.amber}25`,
                  borderRadius: 8, color: T.amber, fontSize: 12,
                }}>
                  ⚠ {selected.notes}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 12, color: T.slate, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Статистика
            </div>
            {[
              { label: 'Визитов всего',  value: patientAppts.length },
              { label: 'Завершено',      value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').length },
              { label: 'Отменено',       value: patientAppts.filter(a => a.status === 'cancelled').length },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? `1px solid ${T.borderSub}` : 'none' }}>
                <span style={{ fontSize: 12, color: T.slate }}>{s.label}</span>
                <span style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* Right panel */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${T.borderSub}`, padding: '0 20px' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '14px 16px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${activeTab === tab.id ? T.gold : 'transparent'}`,
                  color: activeTab === tab.id ? T.gold : T.slate,
                  fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: 'pointer', transition: 'color .12s', whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {/* Info tab */}
            {activeTab === 'info' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 14 }}>🗒 Планы и заметки</div>
                <div style={{
                  padding: 16, background: 'rgba(255,255,255,0.03)',
                  border: `1px dashed ${T.borderSub}`, borderRadius: 10,
                  color: T.slate, fontSize: 13, marginBottom: 16,
                }}>
                  {selected.notes || 'Нет особых заметок. Для добавления нажмите «Редактировать».'}
                </div>
                <AutoTreatmentPlan
                  teeth={teethState}
                  onAddToPlan={(recs) => showToast(`Добавлено ${recs.length} процедур в план`, 'success')}
                />
              </div>
            )}

            {/* Odontogram tab */}
            {activeTab === 'odontogram' && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <ToothLegend />
                </div>
                <Odontogram3D
                  patientTeeth={teethState}
                  onToothClick={handleToothClick}
                  selectedTooth={selectedTooth}
                />
                {selectedTooth && (
                  <SurfaceEditor
                    toothNumber={selectedTooth}
                    surfaces={teethState[selectedTooth]?.surfaces || {}}
                    onSave={handleSaveToothSurfaces}
                    onCancel={() => setSelectedTooth(null)}
                  />
                )}
              </div>
            )}

            {/* Payment tab */}
            {activeTab === 'payment' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 14 }}>💰 Оплата и финансовые операции</div>
                
                {/* Payment summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Всего оплачено', value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0), color: T.emerald },
                    { label: 'Ожидает оплаты', value: patientAppts.filter(a => a.status === 'confirmed' || a.status === 'scheduled').reduce((sum, a) => sum + (a.price || 0), 0), color: T.amber },
                    { label: 'Скидки', value: selected.category === 'vip' ? '15%' : selected.category === 'regular' ? '5%' : '0%', color: T.sapphire },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: 16, background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${T.borderSub}`, borderRadius: 10,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: T.slate, marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>
                        {typeof s.value === 'number' ? `${s.value.toLocaleString()} ₸` : s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment form */}
                <div style={{
                  padding: 16, background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${T.borderSub}`, borderRadius: 10, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 12 }}>✍️ Внести оплату</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: 11, color: T.slate, marginBottom: 4, display: 'block' }}>Сумма (₸)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={payment.amount}
                        onChange={e => setPayment({ ...payment, amount: e.target.value })}
                        style={{
                          width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)',
                          border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13,
                          color: T.white, outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: T.slate, marginBottom: 4, display: 'block' }}>Тип оплаты</label>
                      <select
                        value={payment.payMethod}
                        onChange={e => setPayment({ ...payment, payMethod: e.target.value })}
                        style={{
                          width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.06)',
                          border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13,
                          color: T.white, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        <option value="cash">💵 Наличные</option>
                        <option value="card">💳 Карта</option>
                        <option value="transfer">🏦 Перевод</option>
                      </select>
                    </div>
                    <PBtn onClick={() => {
                      if (!payment.amount || Number(payment.amount) <= 0) { showToast('Укажите сумму', 'warning'); return; }
                      showToast(`Оплата ${tg(Number(payment.amount))} внесена успешно`, 'success');
                      setPayment(EMPTY_PAYMENT);
                    }}>Внести</PBtn>
                  </div>
                </div>

                {/* Payment history */}
                <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 12 }}>📜 История платежей</div>
                {patientAppts.filter(a => a.price).length === 0 ? (
                  <EmptyState icon="💰" text="Нет записей об оплате" sub="Платежи появятся после завершения приёмов" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {patientAppts.filter(a => a.price).map(a => (
                      <div key={a.id} style={{
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${T.borderSub}`,
                        borderRadius: 9,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{a.reason || a.service || '—'}</div>
                          <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{fd(a.date)} · {a.time}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Badge color={T.emerald} size="sm">+{a.price.toLocaleString()} ₸</Badge>
                          <button
                            onClick={() => showToast('Чек отправлен пациенту', 'success')}
                            style={{
                              padding: '6px 10px', background: 'rgba(255,255,255,0.05)',
                              border: `1px solid ${T.borderSub}`, borderRadius: 6,
                              color: T.slate, fontSize: 11, cursor: 'pointer',
                            }}
                          >
                            📤 Чек
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Photos tab */}
            {activeTab === 'photos' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['smile', 'face', 'intraoral', 'xray'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setPhotoCategory(cat)}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', transition: 'all .12s',
                        background: photoCategory === cat ? `${T.gold}20` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${photoCategory === cat ? T.gold : T.borderSub}`,
                        color: photoCategory === cat ? T.gold : T.slate,
                      }}
                    >
                      {{ smile: '😊 Улыбка', face: '👤 Лицо', intraoral: '🦷 Интраоральные', xray: '☢️ Рентген' }[cat]}
                    </button>
                  ))}
                </div>

                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '30px', border: `2px dashed ${T.border}`, borderRadius: 12,
                  cursor: 'pointer', marginBottom: 16, color: T.slate, fontSize: 13,
                  transition: 'all .15s',
                }}>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  <span style={{ fontSize: 30, marginBottom: 8 }}>📷</span>
                  Нажмите для загрузки фото
                </label>

                {photos.filter(p => p.category === photoCategory).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    {photos.filter(p => p.category === photoCategory).map(photo => (
                      <div key={photo.id} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.borderSub}` }}>
                        <img src={photo.url} alt="Patient" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '8px 10px', fontSize: 11, color: T.slate }}>
                          {fd(photo.date)}
                          <button
                            onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                            style={{ float: 'right', background: 'none', border: 'none', color: T.ruby, cursor: 'pointer', fontSize: 14 }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="📷" text="Нет фото в этой категории" />
                )}
              </div>
            )}

            {/* History tab */}
            {activeTab === 'history' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 14 }}>История посещений</div>
                {patientAppts.length === 0 ? (
                  <EmptyState icon="📋" text="Нет записей о посещениях" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {patientAppts.map(a => {
                      const sc = { scheduled: T.sapphire, confirmed: T.emerald, done: T.teal, cancelled: T.ruby, completed: T.teal }[a.status] || T.slate;
                      return (
                        <div key={a.id} style={{
                          padding: '12px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${T.borderSub}`,
                          borderLeft: `3px solid ${sc}`,
                          borderRadius: 9,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        }}>
                          <div>
                            <div style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{a.reason || a.service || '—'}</div>
                            <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{fd(a.date)} · {a.time}</div>
                          </div>
                          <Badge color={sc} size="sm">
                            {{ scheduled: 'Запланирован', confirmed: 'Подтверждён', done: 'Завершён', cancelled: 'Отменён', completed: 'Завершён' }[a.status] || a.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Edit modal (from detail view) */}
      {modalOpen && (
        <Modal title="Редактировать пациента" onClose={() => setModalOpen(false)} size="md">
          <form onSubmit={handleSubmit}>
            <Input label="ФИО" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
              <Input label="Дата рождения" type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Select label="Категория" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              options={Object.entries(CAT_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
            <Textarea label="Заметки / аллергии" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Сохранить</PBtn>
              <PBtn type="button" variant="danger" onClick={handleDelete}>Удалить</PBtn>
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
