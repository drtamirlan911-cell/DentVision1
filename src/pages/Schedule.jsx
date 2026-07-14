import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, APPOINTMENT_STATUS, HOURS, today, fd, ALL_SERVICES, PAY_METHODS, gid } from '../utils/constants';
import { tg } from '../utils/constants';

const STATUS_CFG = APPOINTMENT_STATUS;

const EMPTY_FORM = {
  patientId: '', doctorId: '', service: '', time: '09:00', status: 'scheduled', notes: '', duration: 60,
};

const EMPTY_PATIENT = { name: '', phone: '', email: '', dob: '', gender: '', notes: '' };
const EMPTY_PAYMENT = { payMethod: 'Наличные', amount: 0, paid: false };

export default function Schedule() {
  const { clinic, user, roleInfo } = useOutletContext();
  const { appointments, patients, doctors, upsertAppointment, deleteAppointment, upsertPatient, upsertReceipt } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [selDate, setSelDate] = useState(today());
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dragged, setDragged] = useState(null);

  // Quick patient creation state
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState(EMPTY_PAYMENT);

  const ownDataOnly = !!roleInfo?.ownDataOnly && user?.role === 'doctor';
  const dayAppts = ownDataOnly
    ? appointments.filter(a => a.date === selDate && a.doctorId === user.id)
    : appointments.filter(a => a.date === selDate);

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

  const openSlotBooking = (time) => {
    setEditAppt(null);
    setForm({ ...EMPTY_FORM, time });
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
    if (!newPatient.name.trim()) {
      showToast('Введите ФИО пациента', 'warning');
      return null;
    }
    const patientData = {
      ...newPatient,
      id: gid(),
      clinicId: clinic?.id,
      category: 'new',
    };
    const created = await upsertPatient(patientData);
    showToast('Пациент добавлен', 'success');
    return created;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let patientId = form.patientId;

    // Create new patient if needed
    if (showNewPatient && !patientId) {
      const created = await handleCreatePatient();
      if (!created) return;
      patientId = created.id;
    }

    if (!patientId || !form.time) {
      showToast('Выберите пациента и время', 'warning');
      return;
    }

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

      // Create receipt if payment enabled
      if (showPayment && payment.paid && selectedService) {
        await upsertReceipt({
          id: gid(),
          clinicId: clinic?.id,
          patientId,
          doctorId: form.doctorId || null,
          amount: selectedService.price,
          payMethod: payment.payMethod,
          status: 'paid',
          notes: `Оплата: ${selectedService.name}`,
          date: selDate,
        });
        showToast('Оплата принята', 'success');
      }

      setModalOpen(false);
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const handleDelete = async () => {
    if (!editAppt) return;
    if (!window.confirm('Удалить запись?')) return;
    await deleteAppointment(editAppt.id);
    showToast('Запись удалена', 'success');
    setModalOpen(false);
  };

  const handleDrop = async (e, timeSlot) => {
    e.preventDefault();
    if (!dragged) return;
    await upsertAppointment({ ...dragged, time: timeSlot, date: selDate });
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

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>Расписание</h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Управление записями пациентов</p>
        </div>
        <PBtn onClick={openNew}>+ Новая запись</PBtn>
      </div>

      {/* Date nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '12px 16px', flexWrap: 'wrap',
      }}>
        <GBtn onClick={() => shiftDate(-1)}>‹</GBtn>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.white, outline: 'none', fontFamily: 'inherit' }} />
        <GBtn onClick={() => shiftDate(1)}>›</GBtn>
        <GBtn onClick={() => setSelDate(today())} color={T.gold}>Сегодня</GBtn>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CFG).slice(0, 4).map(([k, v]) => (
            <Badge key={k} color={v.dot} size="sm">{v.label}</Badge>
          ))}
        </div>
      </div>

      {/* Schedule grid */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {HOURS.map((time, idx) => {
            const slotAppts = dayAppts.filter(a => a.time === time);
            const isWorkHour = time >= '09:00' && time <= '19:00';
            return (
              <div key={time} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, time)}
                style={{
                  display: 'flex', borderBottom: `1px solid ${T.borderSub}`,
                  minHeight: slotAppts.length > 0 ? 'auto' : 52,
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                <div style={{
                  width: 68, minWidth: 68, padding: '12px 14px', fontSize: 12,
                  color: isWorkHour ? T.slateL : T.slate, fontWeight: isWorkHour ? 600 : 400,
                  borderRight: `1px solid ${T.borderSub}`, display: 'flex', alignItems: 'flex-start', paddingTop: 14,
                }}>
                  {time}
                </div>
                <div style={{ flex: 1, padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => slotAppts.length === 0 && isWorkHour && openSlotBooking(time)}>
                  {slotAppts.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.slate + '60', padding: '6px 0', fontStyle: 'italic' }}>
                      {isWorkHour ? 'Свободно (нажмите для записи)' : ''}
                    </div>
                  ) : (
                    slotAppts.map(appt => {
                      const patient = patients.find(p => p.id === appt.patientId);
                      const doctor = doctors.find(d => d.id === appt.doctorId);
                      const sc = STATUS_CFG[appt.status] || STATUS_CFG.scheduled;
                      return (
                        <div key={appt.id} draggable onDragStart={() => setDragged(appt)} onClick={(e) => { e.stopPropagation(); openEdit(appt); }}
                          style={{
                            minWidth: 200, maxWidth: 280, padding: '10px 12px', borderRadius: 9,
                            background: `${sc.dot}12`, border: `1px solid ${sc.dot}30`, borderLeft: `3px solid ${sc.dot}`,
                            cursor: 'pointer', transition: 'all .12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{patient?.name || 'Пациент'}</span>
                            <Badge color={sc.color} size="sm">{sc.label}</Badge>
                          </div>
                          <div style={{ fontSize: 11, color: T.slate }}>{appt.service || appt.reason || '—'}</div>
                          {doctor && <div style={{ fontSize: 11, color: T.gold + 'aa', marginTop: 3 }}>👨‍⚕️ {doctor.name}</div>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
        {[
          { label: 'Всего записей', value: dayAppts.length, color: T.sapphire },
          { label: 'Подтверждено', value: dayAppts.filter(a => a.status === 'confirmed').length, color: T.emerald },
          { label: 'Завершено', value: dayAppts.filter(a => a.status === 'done' || a.status === 'completed').length, color: T.teal },
          { label: 'Отменено', value: dayAppts.filter(a => a.status === 'cancelled').length, color: T.ruby },
        ].map((s, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal title={editAppt ? 'Редактировать запись' : 'Новая запись'} onClose={() => setModalOpen(false)} size="lg">
          <form onSubmit={handleSubmit}>
            {/* Patient selection */}
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
              <div style={{
                padding: 14, marginBottom: 14, borderRadius: 10,
                background: `${T.gold}08`, border: `1px solid ${T.gold}25`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>Новый пациент</span>
                  <button type="button" onClick={() => { setShowNewPatient(false); setNewPatient(EMPTY_PATIENT); }} style={{
                    background: 'none', border: 'none', color: T.slate, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
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

            {/* Doctor + Service */}
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

            {/* Time + Duration + Status */}
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

            {/* Payment section */}
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
              {editAppt && <PBtn type="button" variant="danger" onClick={handleDelete}>Удалить</PBtn>}
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
