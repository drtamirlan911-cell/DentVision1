import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, APPOINTMENT_STATUS, HOURS, today, ALL_SERVICES, PAY_METHODS, gid } from '../utils/constants';
import { tg } from '../utils/constants';
import {
  Clock, Calendar, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckCircle, XCircle, Search, ListOrdered, GripVertical,
} from 'lucide-react';

const STATUS_CFG = APPOINTMENT_STATUS;

const WORK_START = '08:00';
const WORK_END = '20:00';

const HOUR_HEIGHT = 64;
const MIN_PER_SLOT = 30;

const EMPTY_FORM = {
  patientId: '', doctorId: '', service: '', time: '09:00', status: 'scheduled', notes: '', duration: 60,
};
const EMPTY_PATIENT = { name: '', phone: '', email: '', dob: '', gender: '', notes: '' };
const EMPTY_PAYMENT = { payMethod: 'Наличные', amount: 0, paid: false };
const EMPTY_WAIT = { patientId: '', patientName: '', patientPhone: '', doctorId: '', preferredDate: '', preferredTime: '', preferredService: '', notes: '' };

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTop(minutes) {
  const startMin = timeToMinutes(WORK_START);
  return ((minutes - startMin) / MIN_PER_SLOT) * (HOUR_HEIGHT / 2);
}

function formatDuration(mins) {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export default function Schedule() {
  const { clinic, user, roleInfo } = useOutletContext();
  const {
    appointments, patients, doctors, waitingList,
    upsertAppointment, deleteAppointment,
    upsertPatient, upsertReceipt,
    upsertWaitingListItem, deleteWaitingListItem,
  } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();

  const [selDate, setSelDate] = useState(today());
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dragged, setDragged] = useState(null);
  const [viewMode, setViewMode] = useState('doctors');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('schedule');
  const [waitModalOpen, setWaitModalOpen] = useState(false);
  const [waitForm, setWaitForm] = useState(EMPTY_WAIT);
  const [editWaitId, setEditWaitId] = useState(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState(EMPTY_PAYMENT);
  const [searchAppts, setSearchAppts] = useState('');

  const ownDataOnly = !!roleInfo?.ownDataOnly && user?.role === 'doctor';

  const dayAppts = useMemo(() => {
    let list = appointments.filter(a => a.date === selDate);
    if (ownDataOnly) list = list.filter(a => a.doctorId === user.id);
    if (selectedDoctorFilter !== 'all') list = list.filter(a => a.doctorId === selectedDoctorFilter);
    if (searchAppts) {
      const q = searchAppts.toLowerCase();
      list = list.filter(a => {
        const p = patients.find(pt => pt.id === a.patientId);
        return p?.name?.toLowerCase().includes(q) || a.notes?.toLowerCase().includes(q) || a.service?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [appointments, selDate, ownDataOnly, user, selectedDoctorFilter, patients, searchAppts]);

  const dayWaitList = useMemo(
    () => waitingList.filter(w => w.status === 'waiting' && (!w.preferred_date || w.preferred_date === selDate)),
    [waitingList, selDate]
  );

  const doctorColumns = useMemo(() => {
    if (selectedDoctorFilter !== 'all') {
      const doc = doctors.find(d => d.id === selectedDoctorFilter);
      return doc ? [doc] : [];
    }
    return doctors;
  }, [doctors, selectedDoctorFilter]);

  const serviceOptions = [
    { value: '', label: '— Выберите услугу —' },
    ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${tg(s.price)}` })),
  ];
  const selectedService = ALL_SERVICES.find(s => s.id === form.service);

  const openNew = () => {
    setEditAppt(null);
    setForm(EMPTY_FORM);
    setShowNewPatient(false);
    setNewPatient(EMPTY_PATIENT);
    setShowPayment(false);
    setPayment(EMPTY_PAYMENT);
    setModalOpen(true);
  };

  const openSlotBooking = (time, doctorId) => {
    setEditAppt(null);
    setForm({ ...EMPTY_FORM, time, doctorId: doctorId || '' });
    setShowNewPatient(false);
    setNewPatient(EMPTY_PATIENT);
    setShowPayment(false);
    setPayment(EMPTY_PAYMENT);
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditAppt(a);
    setForm({
      patientId: a.patientId || '',
      doctorId: a.doctorId || '',
      service: a.service || a.reason || '',
      time: a.time,
      status: a.status,
      notes: a.notes || '',
      duration: a.duration || 60,
    });
    setShowNewPatient(false);
    setShowPayment(false);
    setModalOpen(true);
  };

  const handleCreatePatient = async () => {
    if (!newPatient.name.trim()) { showToast('Введите ФИО пациента', 'warning'); return null; }
    const patientData = { ...newPatient, id: gid(), clinicId: clinic?.id, category: 'new' };
    const created = await upsertPatient(patientData);
    showToast('Пациент добавлен', 'success');
    return created;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let patientId = form.patientId;
    if (showNewPatient && !patientId) {
      const created = await handleCreatePatient();
      if (!created) return;
      patientId = created.id;
    }
    if (!patientId || !form.time) { showToast('Выберите пациента и время', 'warning'); return; }
    try {
      await upsertAppointment({
        ...form,
        id: editAppt?.id,
        clinicId: clinic?.id,
        date: selDate,
        patientId,
        serviceId: form.service,
        serviceName: selectedService?.name || form.service,
        servicePrice: selectedService?.price || 0,
        reason: selectedService?.name || form.service,
      });
      showToast(editAppt ? 'Запись обновлена' : 'Запись создана', 'success');
      if (showPayment && payment.paid && selectedService) {
        await upsertReceipt({
          id: gid(), clinicId: clinic?.id, patientId, doctorId: form.doctorId || null,
          amount: selectedService.price, payMethod: payment.payMethod, status: 'paid',
          notes: `Оплата: ${selectedService.name}`, date: selDate,
        });
        showToast('Оплата принята', 'success');
      }
      setModalOpen(false);
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  const handleDelete = async () => {
    if (!editAppt || !window.confirm('Удалить запись?')) return;
    await deleteAppointment(editAppt.id);
    showToast('Запись удалена', 'success');
    setModalOpen(false);
  };

  const handleDrop = async (e, timeSlot, doctorId) => {
    e.preventDefault();
    if (!dragged) return;
    await upsertAppointment({ ...dragged, time: timeSlot, date: selDate, doctorId: doctorId || dragged.doctorId });
    showToast('Запись перенесена', 'success');
    setDragged(null);
  };

  const shiftDate = (days) => {
    const d = new Date(selDate);
    d.setDate(d.getDate() + days);
    setSelDate(d.toISOString().slice(0, 10));
  };

  const patientOptions = [
    { value: '', label: '— Выберите пациента —' },
    ...patients.map(p => ({ value: p.id, label: p.name })),
  ];
  const doctorOptions = [
    { value: '', label: '— Выберите врача —' },
    ...doctors.map(d => ({ value: d.id, label: `${d.name} (${d.spec || 'Врач'})` })),
  ];

  const dayStats = useMemo(() => ({
    total: dayAppts.length,
    confirmed: dayAppts.filter(a => a.status === 'confirmed' || a.status === 'done' || a.status === 'completed').length,
    scheduled: dayAppts.filter(a => a.status === 'scheduled' || a.status === 'pending').length,
    cancelled: dayAppts.filter(a => a.status === 'cancelled' || a.status === 'noShow').length,
  }), [dayAppts]);

  const handleSaveWait = async () => {
    if (!waitForm.patientName.trim()) { showToast('Введите ФИО пациента', 'warning'); return; }
    const patient = patients.find(p => p.id === waitForm.patientId);
    const doctor = doctors.find(d => d.id === waitForm.doctorId);
    await upsertWaitingListItem({
      id: editWaitId || gid(),
      clinicId: clinic?.id,
      patientId: waitForm.patientId || null,
      patientName: waitForm.patientName || patient?.name || '',
      patientPhone: waitForm.patientPhone || patient?.phone || '',
      doctorId: waitForm.doctorId || null,
      doctorName: doctor?.name || '',
      preferredDate: waitForm.preferredDate || null,
      preferredTime: waitForm.preferredTime || null,
      preferredService: waitForm.preferredService || '',
      notes: waitForm.notes || '',
      status: 'waiting',
    });
    showToast(editWaitId ? 'Запись обновлена' : 'Пациент добавлен в лист ожидания', 'success');
    setWaitModalOpen(false);
    setEditWaitId(null);
    setWaitForm(EMPTY_WAIT);
  };

  const handleDeleteWait = async (id) => {
    if (!window.confirm('Удалить из листа ожидания?')) return;
    await deleteWaitingListItem(id);
    showToast('Удалено из листа ожидания', 'success');
  };

  const handlePromoteFromWait = async (w) => {
    const patient = patients.find(p => p.id === w.patient_id) || { name: w.patient_name, phone: w.patient_phone };
    setForm({
      ...EMPTY_FORM,
      patientId: w.patient_id || '',
      doctorId: w.doctor_id || '',
      time: w.preferred_time || '09:00',
      service: w.preferred_service || '',
    });
    setShowNewPatient(false);
    setShowPayment(false);
    setPayment(EMPTY_PAYMENT);
    setModalOpen(true);
    await deleteWaitingListItem(w.id);
    showToast('Перенесён в форму записи', 'info');
  };

  const renderAppointmentBlock = (appt, compact = false) => {
    const patient = patients.find(p => p.id === appt.patientId);
    const sc = STATUS_CFG[appt.status] || STATUS_CFG.scheduled;
    const dur = appt.duration || 60;
    const heightPx = (dur / MIN_PER_SLOT) * (HOUR_HEIGHT / 2) - 4;
    return (
      <div
        key={appt.id}
        draggable
        onDragStart={() => setDragged(appt)}
        onClick={(e) => { e.stopPropagation(); openEdit(appt); }}
        style={{
          background: `${sc.dot}15`,
          border: `1px solid ${sc.dot}30`,
          borderLeft: `3px solid ${sc.dot}`,
          borderRadius: 8,
          padding: compact ? '6px 8px' : '8px 10px',
          marginBottom: 4,
          cursor: 'grab',
          transition: 'all .12s',
          minHeight: compact ? 32 : heightPx,
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          <span style={{ fontSize: compact ? 11 : 12, color: T.white, fontWeight: 600, lineHeight: 1.2 }}>
            {patient?.name || 'Пациент'}
          </span>
          <span style={{ fontSize: 9, color: sc.dot, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {appt.time}
          </span>
        </div>
        <div style={{ fontSize: compact ? 10 : 11, color: T.slate, marginTop: 2 }}>
          {appt.service || appt.reason || '—'}
        </div>
        {!compact && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: T.gold + 'aa' }}>
              {formatDuration(dur)}
            </span>
            {sc.dot && (
              <span style={{
                fontSize: 8, fontWeight: 700, color: sc.dot, background: `${sc.dot}15`,
                padding: '1px 6px', borderRadius: 10,
              }}>
                {sc.label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} color={T.gold} /> Расписание
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Управление записями и лист ожидания</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PBtn onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Новая запись
          </PBtn>
          {roleInfo?.key !== 'doctor' && (
            <GBtn onClick={() => { setWaitForm(EMPTY_WAIT); setEditWaitId(null); setWaitModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListOrdered size={14} /> Лист ожидания
              {dayWaitList.length > 0 && (
                <span style={{
                  background: T.ruby, color: T.white, fontSize: 10, fontWeight: 700,
                  borderRadius: 10, padding: '1px 7px', marginLeft: 4,
                }}>
                  {dayWaitList.length}
                </span>
              )}
            </GBtn>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'schedule', label: 'Расписание', icon: Calendar },
          { key: 'waiting', label: `Лист ожидания (${dayWaitList.length})`, icon: ListOrdered },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === tab.key ? `${T.gold}20` : 'rgba(255,255,255,0.03)',
              color: activeTab === tab.key ? T.gold : T.slate,
              borderBottom: activeTab === tab.key ? `2px solid ${T.gold}` : '2px solid transparent',
              transition: 'all .15s',
            }}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' ? (
        <>
          {/* Date nav + controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '10px 16px', flexWrap: 'wrap',
          }}>
            <GBtn onClick={() => shiftDate(-1)}><ChevronLeft size={16} /></GBtn>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: T.white, outline: 'none', fontFamily: 'inherit' }} />
            <GBtn onClick={() => shiftDate(1)}><ChevronRight size={16} /></GBtn>
            <GBtn onClick={() => setSelDate(today())} color={T.gold}>Сегодня</GBtn>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: T.slate }} />
                <input
                  placeholder="Поиск..."
                  value={searchAppts}
                  onChange={e => setSearchAppts(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: '6px 10px 6px 30px', fontSize: 12, color: T.white, outline: 'none', width: 140, fontFamily: 'inherit',
                  }}
                />
              </div>

              {doctors.length > 1 && (
                <select value={selectedDoctorFilter} onChange={e => setSelectedDoctorFilter(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: '6px 10px', fontSize: 12, color: T.white, outline: 'none', fontFamily: 'inherit',
                  }}>
                  <option value="all">Все врачи</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}

              {roleInfo?.key !== 'doctor' && (
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.borderSub}` }}>
                  {[
                    { key: 'doctors', label: 'По врачам' },
                    { key: 'single', label: 'Общий' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setViewMode(m.key)}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: viewMode === m.key ? `${T.gold}20` : 'transparent',
                        color: viewMode === m.key ? T.gold : T.slate,
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Всего', value: dayStats.total, color: T.sapphire, icon: Calendar },
              { label: 'Запланировано', value: dayStats.scheduled, color: T.gold, icon: Clock },
              { label: 'Подтверждено', value: dayStats.confirmed, color: T.emerald, icon: CheckCircle },
              { label: 'Отмены', value: dayStats.cancelled, color: T.ruby, icon: XCircle },
            ].map((s, i) => (
              <div key={i} style={{
                background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 10,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={15} color={s.color} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: T.slate, marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Doctor columns grid */}
          {doctorColumns.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'doctors' ? `repeat(${Math.min(doctorColumns.length, 4)}, 1fr)` : '1fr', gap: 12 }}>
              {doctorColumns.map(doc => {
                const docAppts = dayAppts.filter(a => a.doctorId === doc.id);
                return (
                  <Card key={doc.id} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                      padding: '10px 14px', borderBottom: `1px solid ${T.borderSub}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: `${T.gold}08`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `linear-gradient(135deg, ${T.gold}30, ${T.sapphire}30)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: T.gold,
                        }}>
                          {(doc.name || '?')[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.white }}>{doc.name}</div>
                          <div style={{ fontSize: 10, color: T.slate }}>{doc.spec || 'Врач'} · {docAppts.length} записей</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: 520 }}>
                      {HOURS.filter(h => h >= WORK_START && h <= WORK_END).map(time => {
                        const slotAppts = docAppts.filter(a => a.time === time);
                        const min = timeToMinutes(time);
                        const isLunch = min >= 720 && min < 780;
                        return (
                          <div key={time}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, time, doc.id)}
                            onClick={() => slotAppts.length === 0 && !isLunch && openSlotBooking(time, doc.id)}
                            style={{
                              display: 'flex', borderBottom: `1px solid ${T.borderSub}`,
                              minHeight: HOUR_HEIGHT,
                              background: isLunch ? `${T.gold}05` : slotAppts.length > 0 ? 'transparent' : 'transparent',
                              cursor: slotAppts.length === 0 && !isLunch ? 'pointer' : 'default',
                              transition: 'background .1s',
                            }}
                            onMouseEnter={e => { if (slotAppts.length === 0 && !isLunch) e.currentTarget.style.background = `${T.gold}08`; }}
                            onMouseLeave={e => { if (slotAppts.length === 0 && !isLunch) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{
                              width: 48, minWidth: 48, padding: '8px 0',
                              fontSize: 11, color: T.slate, fontWeight: 600,
                              borderRight: `1px solid ${T.borderSub}`,
                              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10,
                            }}>
                              {time}
                            </div>
                            <div style={{ flex: 1, padding: '4px 6px' }}>
                              {isLunch ? (
                                <div style={{ fontSize: 10, color: T.gold + '60', fontStyle: 'italic', paddingTop: 6, textAlign: 'center' }}>
                                  Обед
                                </div>
                              ) : slotAppts.length === 0 ? (
                                <div style={{ fontSize: 10, color: T.slate + '30', paddingTop: 6, textAlign: 'center' }}>
                                  Свободно
                                </div>
                              ) : (
                                slotAppts.map(a => renderAppointmentBlock(a))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState text="Нет врачей для отображения" />
          )}
        </>
      ) : (
        /* ─── Waiting List Tab ─── */
        <Card style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.borderSub}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListOrdered size={16} color={T.gold} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Лист ожидания</span>
              <Badge color={T.gold} size="sm">{dayWaitList.length}</Badge>
            </div>
            <PBtn onClick={() => { setWaitForm(EMPTY_WAIT); setEditWaitId(null); setWaitModalOpen(true); }}
              style={{ padding: '6px 14px', fontSize: 12 }}>
              <Plus size={14} /> Добавить
            </PBtn>
          </div>
          {dayWaitList.length === 0 ? (
            <EmptyState text="Лист ожидания пуст" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                    {['Пациент', 'Телефон', 'Врач', 'Желаемое время', 'Услуга', 'Заметки', 'Действия'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: T.slate, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayWaitList.map(w => (
                    <tr key={w.id} style={{ borderBottom: `1px solid ${T.borderSub}`, transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 14px', color: T.white, fontWeight: 600 }}>{w.patient_name || '—'}</td>
                      <td style={{ padding: '10px 14px', color: T.slate }}>{w.patient_phone || '—'}</td>
                      <td style={{ padding: '10px 14px', color: T.gold }}>{w.doctor_name || 'Любой'}</td>
                      <td style={{ padding: '10px 14px', color: T.slateL }}>
                        {w.preferred_time || '—'} {w.preferred_date ? `(${w.preferred_date})` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', color: T.slate }}>{w.preferred_service || '—'}</td>
                      <td style={{ padding: '10px 14px', color: T.slate, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.notes || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handlePromoteFromWait(w)} title="Записать"
                            style={{ background: `${T.emerald}15`, border: `1px solid ${T.emerald}30`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: T.emerald, fontSize: 11 }}>
                            <CheckCircle size={13} />
                          </button>
                          <button onClick={() => {
                            setEditWaitId(w.id);
                            setWaitForm({
                              patientId: w.patient_id || '',
                              patientName: w.patient_name || '',
                              patientPhone: w.patient_phone || '',
                              doctorId: w.doctor_id || '',
                              preferredDate: w.preferred_date || '',
                              preferredTime: w.preferred_time || '',
                              preferredService: w.preferred_service || '',
                              notes: w.notes || '',
                            });
                            setWaitModalOpen(true);
                          }} title="Редактировать"
                            style={{ background: `${T.gold}15`, border: `1px solid ${T.gold}30`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: T.gold, fontSize: 11 }}>
                            <GripVertical size={13} />
                          </button>
                          <button onClick={() => handleDeleteWait(w.id)} title="Удалить"
                            style={{ background: `${T.ruby}15`, border: `1px solid ${T.ruby}30`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: T.ruby, fontSize: 11 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── Appointment Modal ─── */}
      {modalOpen && (
        <Modal title={editAppt ? 'Редактировать запись' : 'Новая запись'} onClose={() => setModalOpen(false)} size="lg">
          <form onSubmit={handleSubmit}>
            {!showNewPatient ? (
              <>
                <Select label="Пациент" value={form.patientId}
                  onChange={e => setForm({ ...form, patientId: e.target.value })}
                  options={patientOptions} required />
                <div style={{ marginBottom: 12 }}>
                  <button type="button" onClick={() => setShowNewPatient(true)} style={{
                    background: 'none', border: `1px dashed ${T.gold}40`, borderRadius: 8,
                    padding: '8px 14px', width: '100%', color: T.gold, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    + Добавить нового пациента
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: 14, marginBottom: 14, borderRadius: 10, background: `${T.gold}08`, border: `1px solid ${T.gold}25` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>Новый пациент</span>
                  <button type="button" onClick={() => { setShowNewPatient(false); setNewPatient(EMPTY_PATIENT); }}
                    style={{ background: 'none', border: 'none', color: T.slate, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Выбрать из списка →
                  </button>
                </div>
                <Input label="ФИО *" value={newPatient.name}
                  onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                  placeholder="Иванов Иван Иванович" required />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Input label="Телефон" value={newPatient.phone}
                    onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                    placeholder="+7 777 000 00 00" />
                  <Input label="Дата рождения" type="date" value={newPatient.dob}
                    onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} />
                </div>
              </div>
            )}

            <Select label="Врач" value={form.doctorId}
              onChange={e => setForm({ ...form, doctorId: e.target.value })}
              options={doctorOptions} />
            <Select label="Услуга из прайса" value={form.service}
              onChange={e => {
                const svc = ALL_SERVICES.find(s => s.id === e.target.value);
                setForm({ ...form, service: e.target.value });
                if (svc) setPayment({ ...payment, amount: svc.price });
              }}
              options={serviceOptions} required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Select label="Время" value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                options={HOURS.map(h => ({ value: h, label: h }))} required />
              <Select label="Длительность" value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                options={[{ value: 30, label: '30 мин' }, { value: 45, label: '45 мин' }, { value: 60, label: '1 час' }, { value: 90, label: '1.5 ч' }, { value: 120, label: '2 часа' }]} />
              <Select label="Статус" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
            </div>

            <Input label="Заметки" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Дополнительная информация" />

            {!editAppt && selectedService && (
              <div style={{
                marginTop: 12, padding: 14, borderRadius: 10,
                background: showPayment ? `${T.emerald}08` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${showPayment ? T.emerald + '30' : T.borderSub}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPayment ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>💰</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: showPayment ? T.emerald : T.slateL }}>
                      Оплата: {tg(selectedService.price)}
                    </span>
                  </div>
                  <button type="button" onClick={() => setShowPayment(!showPayment)} style={{
                    background: showPayment ? `${T.emerald}20` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${showPayment ? T.emerald + '40' : T.borderSub}`,
                    borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    color: showPayment ? T.emerald : T.slate, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {showPayment ? '✓ Принять' : 'Принять оплату'}
                  </button>
                </div>
                {showPayment && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    <Select label="Способ оплаты" value={payment.payMethod}
                      onChange={e => setPayment({ ...payment, payMethod: e.target.value })}
                      options={PAY_METHODS.map(m => ({ value: m, label: m }))} />
                    <Input label="Сумма (₸)" type="number" min="0" value={payment.amount}
                      onChange={e => setPayment({ ...payment, amount: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>
                {editAppt ? 'Сохранить' : showPayment && payment.paid ? 'Записать и принять оплату' : 'Сохранить'}
              </PBtn>
              {editAppt && <PBtn type="button" variant="danger" onClick={handleDelete}><Trash2 size={14} /></PBtn>}
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Waiting List Modal ─── */}
      {waitModalOpen && (
        <Modal title={editWaitId ? 'Редактировать запись' : 'Добавить в лист ожидания'} onClose={() => setWaitModalOpen(false)}>
          <Select label="Пациент (из базы)" value={waitForm.patientId}
            onChange={e => {
              const p = patients.find(pt => pt.id === e.target.value);
              setWaitForm({
                ...waitForm,
                patientId: e.target.value,
                patientName: p?.name || waitForm.patientName,
                patientPhone: p?.phone || waitForm.patientPhone,
              });
            }}
            options={[{ value: '', label: '— Или введите вручную —' }, ...patients.map(p => ({ value: p.id, label: p.name }))]} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="ФИО пациента *" value={waitForm.patientName}
              onChange={e => setWaitForm({ ...waitForm, patientName: e.target.value })}
              placeholder="Иванов Иван Иванович" required />
            <Input label="Телефон" value={waitForm.patientPhone}
              onChange={e => setWaitForm({ ...waitForm, patientPhone: e.target.value })}
              placeholder="+7 777 000 00 00" />
          </div>

          <Select label="Желаемый врач" value={waitForm.doctorId}
            onChange={e => setWaitForm({ ...waitForm, doctorId: e.target.value })}
            options={[{ value: '', label: '— Любой врач —' }, ...doctors.map(d => ({ value: d.id, label: `${d.name} (${d.spec || 'Врач'})` }))]}} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input label="Желаемая дата" type="date" value={waitForm.preferredDate}
              onChange={e => setWaitForm({ ...waitForm, preferredDate: e.target.value })} />
            <Select label="Желаемое время" value={waitForm.preferredTime}
              onChange={e => setWaitForm({ ...waitForm, preferredTime: e.target.value })}
              options={[{ value: '', label: '— Любое —' }, ...HOURS.map(h => ({ value: h, label: h }))]} />
          </div>

          <Input label="Желаемая услуга" value={waitForm.preferredService}
            onChange={e => setWaitForm({ ...waitForm, preferredService: e.target.value })}
            placeholder="Консультация, отбеливание..." />

          <Input label="Заметки" value={waitForm.notes}
            onChange={e => setWaitForm({ ...waitForm, notes: e.target.value })}
            placeholder="Дополнительная информация" />

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <PBtn onClick={handleSaveWait} style={{ flex: 1 }}>{editWaitId ? 'Обновить' : 'Добавить'}</PBtn>
            <GBtn onClick={() => { setWaitModalOpen(false); setEditWaitId(null); }}>Отмена</GBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}
