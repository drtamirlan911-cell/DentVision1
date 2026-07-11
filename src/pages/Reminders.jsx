import React, { useState, useMemo } from 'react';
import { useData, useToast } from '../hooks/useData';
import { getAppointmentReminders, getHygieneReminders, markSent } from '../utils/reminders';
import { Card, Badge, PBtn, GBtn, EmptyState, Toast } from '../components/ui/BaseComponents';
import { T, fd } from '../utils/constants';

export default function Reminders({ clinic, user, roleInfo }) {
  const { patients, appointments, receipts, doctors } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('appointments');

  const readOnly = !!roleInfo?.readOnly;
  const ownDataOnly = !!roleInfo?.ownDataOnly && user?.role === 'doctor';

  // Фильтруем данные по текущему врачу, если это врач
  const scopedAppointments = ownDataOnly 
    ? appointments.filter(a => a.doctorId === user.id) 
    : appointments;
    
  const scopedPatients = ownDataOnly
    ? patients.filter(p => scopedAppointments.some(a => a.patientId === p.id))
    : patients;
    
  // Для врачей также фильтруем список докторов для отображения
  const scopedDoctors = ownDataOnly
    ? doctors.filter(d => d.id === user.id)
    : doctors;

  const appointmentReminders = useMemo(
    () => getAppointmentReminders(scopedAppointments, scopedPatients, scopedDoctors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedAppointments, scopedPatients, scopedDoctors, tick]
  );

  const hygieneReminders = useMemo(
    () => getHygieneReminders(scopedPatients, appointments, receipts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedPatients, appointments, receipts, tick]
  );

  const pendingAppt = appointmentReminders.filter(r => !r.sent).length;
  const pendingHyg = hygieneReminders.filter(r => !r.sent).length;

  const handleSend = (reminder) => {
    window.open(reminder.waLink, '_blank', 'noopener,noreferrer');
    markSent(reminder.id);
    setTick(t => t + 1);
    showToast(`Напоминание отправлено: ${reminder.patient.name}`, 'success');
  };

  const handleMark = (reminder) => {
    markSent(reminder.id);
    setTick(t => t + 1);
    showToast('Отмечено как отправлено', 'info');
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>
            🔔 Напоминания
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>
            WhatsApp-напоминания о приёмах и профгигиене · {clinic?.name}
          </p>
        </div>
        {(pendingAppt + pendingHyg) > 0 && (
          <div style={{
            padding: '8px 14px', background: `${T.amber}15`, border: `1px solid ${T.amber}35`,
            borderRadius: 10, fontSize: 12, color: T.amber, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ⚠ {pendingAppt + pendingHyg} требуют внимания
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: 6 }}>
        {[
          { id: 'appointments', label: `📅 Приёмы (24ч)`, count: pendingAppt },
          { id: 'hygiene', label: `🦷 Проф. гигиена (6+ мес)`, count: pendingHyg },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .12s', fontFamily: 'inherit',
            background: tab === t.id ? `${T.gold}20` : 'transparent',
            color: tab === t.id ? T.gold : T.slate,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: T.ruby, color: T.white, borderRadius: 20,
                fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Appointments tab */}
      {tab === 'appointments' && (
        appointmentReminders.length === 0 ? (
          <EmptyState icon="✅" text="Нет ближайших приёмов" sub="Все записи на ближайшие 24 часа уже обработаны" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appointmentReminders.map(r => (
              <Card key={r.id} style={{ opacity: r.sent ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{r.patient.name}</span>
                      {r.sent && <Badge color={T.emerald} size="sm">✓ Отправлено</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: T.slateL, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>📅 {fd(r.appointment.date)} в {r.appointment.time}</span>
                      <span>👨‍⚕️ {r.doctor?.name || '—'}</span>
                      <span>📞 {r.patient.phone}</span>
                    </div>
                    {r.appointment.reason && (
                      <div style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>📝 {r.appointment.reason}</div>
                    )}
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <PBtn onClick={() => handleSend(r)} size="sm">
                        💬 Отправить WhatsApp
                      </PBtn>
                      {!r.sent && <GBtn size="sm" onClick={() => handleMark(r)}>Отметить</GBtn>}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Hygiene tab */}
      {tab === 'hygiene' && (
        hygieneReminders.length === 0 ? (
          <EmptyState icon="🦷" text="Нет просроченных напоминаний" sub="У всех пациентов профгигиена в норме (менее 6 мес.)" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hygieneReminders.map(r => (
              <Card key={r.id} style={{ opacity: r.sent ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{r.patient.name}</span>
                      {r.sent && <Badge color={T.emerald} size="sm">✓ Отправлено</Badge>}
                      {!r.sent && (
                        <Badge color={r.monthsSince ? T.amber : T.ruby} size="sm">
                          {r.monthsSince ? `${r.monthsSince} мес. назад` : 'Никогда не было'}
                        </Badge>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.slateL, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>📞 {r.patient.phone}</span>
                      <span>🦷 Последняя гигиена: {r.lastDate ? fd(r.lastDate) : 'нет данных'}</span>
                    </div>
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <PBtn onClick={() => handleSend(r)} size="sm">
                        💬 Отправить WhatsApp
                      </PBtn>
                      {!r.sent && <GBtn size="sm" onClick={() => handleMark(r)}>Отметить</GBtn>}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Info footer */}
      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSub}`, borderRadius: 10,
        fontSize: 11, color: T.slate, lineHeight: 1.6,
      }}>
        💡 Кнопка «Отправить WhatsApp» открывает чат с готовым текстом сообщения — просто нажмите «Отправить» в WhatsApp.
        Профгигиена определяется автоматически по завершённым приёмам и чекам с услугой «Гигиена».
      </div>
    </div>
  );
}
