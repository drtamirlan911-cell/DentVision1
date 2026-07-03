import React, { useState } from 'react';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, APPOINTMENT_STATUS, HOURS, today, fd, ALL_SERVICES } from '../utils/constants';

const STATUS_CFG = {
  scheduled:  { label: 'Запланирован', color: T.sapphire },
  confirmed:  { label: 'Подтверждён',  color: T.emerald },
  pending:    { label: 'Ожидает',      color: T.amber },
  done:       { label: 'Завершён',     color: T.teal },
  cancelled:  { label: 'Отменён',      color: T.ruby },
  noshow:     { label: 'Неявка',       color: T.slate },
  completed:  { label: 'Завершён',     color: T.teal },
};

const EMPTY_FORM = {
  patientId: '', doctorId: '', service: '', time: '09:00', status: 'scheduled', notes: '', duration: 60,
};

export default function Schedule({ clinic }) {
  const { appointments, patients, doctors, upsertAppointment, deleteAppointment } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [selDate, setSelDate] = useState(today());
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dragged, setDragged] = useState(null);
  const [view, setView] = useState('day');

  const dayAppts = appointments.filter(a => a.date === selDate);

  // Опции услуг из прайса с ценами
  const serviceOptions = [
    { value: '', label: '— Выберите услугу —' },
    ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${s.price} ₽` })),
  ];

  const openNew = () => {
    setEditAppt(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openSlotBooking = (time) => {
    setEditAppt(null);
    setForm({ ...EMPTY_FORM, time });
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditAppt(a);
    setForm({
      patientId: a.patientId || '',
      doctorId:  a.doctorId  || '',
      service:   a.service   || a.reason || '',
      time:      a.time,
      status:    a.status,
      notes:     a.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.time) {
      showToast('Выберите пациента и время', 'warning');
      return;
    }
    // Получаем информацию об услуге из прайса
    const selectedService = ALL_SERVICES.find(s => s.id === form.service);
    try {
      await upsertAppointment({
        ...form,
        id:       editAppt?.id,
        clinicId: clinic?.id,
        date:     selDate,
        serviceId: form.service,
        serviceName: selectedService?.name || form.service,
        servicePrice: selectedService?.price || 0,
        reason:   selectedService?.name || form.service,
      });
      showToast(editAppt ? 'Запись обновлена' : 'Запись создана', 'success');
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
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        background: T.card,
        border: `1px solid ${T.borderSub}`,
        borderRadius: 11,
        padding: '12px 16px',
        flexWrap: 'wrap',
      }}>
        <GBtn onClick={() => shiftDate(-1)}>‹</GBtn>
        <input
          type="date"
          value={selDate}
          onChange={e => setSelDate(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: T.white,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <GBtn onClick={() => shiftDate(1)}>›</GBtn>
        <GBtn onClick={() => setSelDate(today())} color={T.gold}>Сегодня</GBtn>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CFG).slice(0, 4).map(([k, v]) => (
            <Badge key={k} color={v.color} size="sm">{v.label}</Badge>
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
              <div
                key={time}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, time)}
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${T.borderSub}`,
                  minHeight: slotAppts.length > 0 ? 'auto' : 52,
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  transition: 'background .1s',
                }}
              >
                {/* Time label */}
                <div style={{
                  width: 68,
                  minWidth: 68,
                  padding: '12px 14px',
                  fontSize: 12,
                  color: isWorkHour ? T.slateL : T.slate,
                  fontWeight: isWorkHour ? 600 : 400,
                  borderRight: `1px solid ${T.borderSub}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: 14,
                }}>
                  {time}
                </div>

                {/* Appointments */}
                <div 
                  style={{ flex: 1, padding: '8px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => slotAppts.length === 0 && isWorkHour && openSlotBooking(time)}
                >
                  {slotAppts.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.slate + '60', padding: '6px 0', fontStyle: 'italic' }}>
                      {isWorkHour ? 'Свободно (нажмите для записи)' : ''}
                    </div>
                  ) : (
                    slotAppts.map(appt => {
                      const patient = patients.find(p => p.id === appt.patientId);
                      const doctor  = doctors.find(d => d.id === appt.doctorId);
                      const sc = STATUS_CFG[appt.status] || STATUS_CFG.scheduled;
                      return (
                        <div
                          key={appt.id}
                          draggable
                          onDragStart={() => setDragged(appt)}
                          onClick={() => openEdit(appt)}
                          style={{
                            minWidth: 200,
                            maxWidth: 280,
                            padding: '10px 12px',
                            borderRadius: 9,
                            background: `${sc.color}12`,
                            border: `1px solid ${sc.color}30`,
                            borderLeft: `3px solid ${sc.color}`,
                            cursor: 'pointer',
                            transition: 'all .12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>
                              {patient?.name || 'Пациент'}
                            </span>
                            <Badge color={sc.color} size="sm">{sc.label}</Badge>
                          </div>
                          <div style={{ fontSize: 11, color: T.slate }}>
                            {appt.service || appt.reason || '—'}
                          </div>
                          {doctor && (
                            <div style={{ fontSize: 11, color: T.gold + 'aa', marginTop: 3 }}>
                              👨‍⚕️ {doctor.name}
                            </div>
                          )}
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
          { label: 'Подтверждено',  value: dayAppts.filter(a => a.status === 'confirmed').length,  color: T.emerald },
          { label: 'Завершено',     value: dayAppts.filter(a => a.status === 'done' || a.status === 'completed').length, color: T.teal },
          { label: 'Отменено',      value: dayAppts.filter(a => a.status === 'cancelled').length,  color: T.ruby },
        ].map((s, i) => (
          <div key={i} style={{
            background: T.card,
            border: `1px solid ${T.borderSub}`,
            borderRadius: 10,
            padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal
          title={editAppt ? 'Редактировать запись' : 'Новая запись'}
          onClose={() => setModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleSubmit}>
            <Select
              label="Пациент"
              value={form.patientId}
              onChange={e => setForm({ ...form, patientId: e.target.value })}
              options={patientOptions}
              required
            />
            <Select
              label="Врач"
              value={form.doctorId}
              onChange={e => setForm({ ...form, doctorId: e.target.value })}
              options={doctorOptions}
            />
            <Select
              label="Услуга из прайса"
              value={form.service}
              onChange={e => setForm({ ...form, service: e.target.value })}
              options={serviceOptions}
              required
              placeholder="Выберите услугу..."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Время"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                options={HOURS.map(h => ({ value: h, label: h }))}
                required
              />
              <Select
                label="Длительность (мин)"
                value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                options={[
                  { value: 30, label: '30 мин' },
                  { value: 45, label: '45 мин' },
                  { value: 60, label: '1 час' },
                  { value: 90, label: '1.5 часа' },
                  { value: 120, label: '2 часа' },
                ]}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Статус"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
            <Input
              label="Заметки"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Дополнительная информация"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Сохранить</PBtn>
              {editAppt && (
                <PBtn type="button" variant="danger" onClick={handleDelete}>Удалить</PBtn>
              )}
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
