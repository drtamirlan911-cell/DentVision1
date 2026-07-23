import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  Calendar,
  Stethoscope,
  Phone,
  FileText,
  MessageSquare,
  Smile,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '../../queries/useDataQuery';
import { getAppointmentReminders, getUrgentReminders, getHygieneReminders, markSent, buildWaLink } from '../../utils/reminders';
import { buildFollowUps } from '../../utils/followUps';
import * as api from '../../utils/api';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { Button } from '../../components/ui/ds/Button';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { useAuth } from '@/store/auth.store';
import { fd } from '../../utils/constants';
import type { Clinic, User, RoleInfo } from '../../types';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function Reminders() {
  const outlet = useOutletContext<{ clinic?: Clinic; user?: User; roleInfo?: RoleInfo }>() || {};
  const auth = useAuth();
  const clinic = outlet.clinic || auth.clinic;
  const user = outlet.user || auth.user;
  const roleInfo = outlet.roleInfo || auth.roleInfo;

  const { patients, appointments, receipts, doctors } = useDataQuery(clinic?.id || user?.clinicId);
  const { showToast } = useToast();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('appointments');
  const [cronRunning, setCronRunning] = useState(false);

  const readOnly = !!(roleInfo as any)?.readOnly;
  const ownDataOnly = !!(roleInfo as any)?.ownDataOnly;

  const scopedAppointments = ownDataOnly
    ? appointments.filter(a => a.doctorId === user?.id)
    : appointments;

  const scopedPatients = ownDataOnly
    ? patients.filter(p => scopedAppointments.some(a => a.patientId === p.id))
    : patients;

  const scopedDoctors = ownDataOnly
    ? doctors.filter(d => d.id === user?.id)
    : doctors;

  const appointmentReminders = useMemo(
    () => getAppointmentReminders(scopedAppointments, scopedPatients, scopedDoctors),
    // deps are correct — getAppointmentReminders is a stable import
    [scopedAppointments, scopedPatients, scopedDoctors, tick]
  );

  const urgentReminders = useMemo(
    () => getUrgentReminders(scopedAppointments, scopedPatients, scopedDoctors),
    // deps are correct — getUrgentReminders is a stable import
    [scopedAppointments, scopedPatients, scopedDoctors, tick]
  );

  const hygieneReminders = useMemo(
    () => getHygieneReminders(scopedPatients, appointments, receipts),
    // deps are correct — getHygieneReminders is a stable import
    [scopedPatients, appointments, receipts, tick]
  );

  const pendingAppt = appointmentReminders.filter(r => !r.sent).length;
  const pendingUrgent = urgentReminders.filter(r => !r.sent).length;
  const pendingHyg = hygieneReminders.filter(r => !r.sent).length;

  const handleSend = async (reminder: { id: string; waLink: string; patient: { name: string } }) => {
    window.open(reminder.waLink, '_blank', 'noopener,noreferrer');
    markSent(reminder.id);
    try {
      if (typeof api.markReminderSent === 'function') {
        await api.markReminderSent(reminder.id);
      }
    } catch { /* optional server sync */ }
    setTick(t => t + 1);
    showToast(`Напоминание отправлено: ${reminder.patient.name}`, 'success');
  };

  const handleMark = async (reminder: { id: string }) => {
    markSent(reminder.id);
    try {
      if (typeof api.markReminderSent === 'function') {
        await api.markReminderSent(reminder.id);
      }
    } catch { /* optional server sync */ }
    setTick(t => t + 1);
    showToast('Отмечено как отправлено', 'info');
  };

  const handleServerCron = async () => {
    if (readOnly) return;
    setCronRunning(true);
    try {
      const result = await api.runClinicReminders({ hoursWindow: 24, hoursMin: 0 });
      const sent = result?.sent ?? result?.data?.sent ?? 0;
      const errors = result?.errors ?? result?.data?.errors ?? 0;
      showToast(`Серверная рассылка: отправлено ${sent}${errors ? `, ошибок ${errors}` : ''}`, sent ? 'success' : 'info');
      setTick(t => t + 1);
    } catch (err: any) {
      showToast(err?.message || 'Не удалось запустить рассылку', 'error');
    } finally {
      setCronRunning(false);
    }
  };

  const followUps = useMemo(
    () => buildFollowUps(scopedAppointments as any, scopedPatients as any),
    [scopedAppointments, scopedPatients],
  );

  const tabs = [
    { id: 'urgent', label: 'Срочно (2ч)', icon: <AlertTriangle size={15} />, count: pendingUrgent },
    { id: 'appointments', label: 'Приёмы (24ч)', icon: <Calendar size={15} />, count: pendingAppt },
    { id: 'hygiene', label: 'Проф. гигиена (6+ мес)', icon: <Smile size={15} />, count: pendingHyg },
    { id: 'followups', label: 'Контроль (хирургия)', icon: <Stethoscope size={15} />, count: followUps.length },
  ];

  const renderReminderList = (reminders: typeof appointmentReminders, emptyTitle: string, emptyDesc: string) => {
    if (reminders.length === 0) {
      return (
        <EmptyState
          icon={<CheckCircle size={28} />}
          title={emptyTitle}
          description={emptyDesc}
        />
      );
    }
    return (
      <div className="flex flex-col gap-2.5">
        {reminders.map(r => (
          <Card key={r.id} className={r.sent ? 'opacity-55' : ''}>
            <CardContent>
              <div className="flex items-center justify-between gap-3.5 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-white">{r.patient.name}</span>
                    {r.sent && <Badge variant="success" size="sm">Отправлено</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-txt-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> {fd(r.appointment.date)} в {r.appointment.time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope size={12} /> {r.doctor?.name || '—'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {r.patient.phone}
                    </span>
                  </div>
                  {r.appointment.reason && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-txt-muted">
                      <FileText size={12} /> {r.appointment.reason}
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<MessageSquare size={14} />}
                      onClick={() => handleSend(r)}
                    >
                      Отправить WhatsApp
                    </Button>
                    {!r.sent && (
                      <Button variant="outline" size="sm" onClick={() => handleMark(r)}>
                        Отметить
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
      className="dv-page space-y-6 py-4 md:py-6"
    >
      {/* Header */}
      <PageHeader
        title="Напоминания"
        subtitle={`WhatsApp / SMS cron + ручные deep-link · ${clinic?.name}`}
        icon={<Bell size={20} />}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!readOnly && (
              <Button variant="secondary" size="sm" onClick={handleServerCron} disabled={cronRunning}>
                {cronRunning ? 'Рассылка…' : 'Серверная рассылка'}
              </Button>
            )}
            {(pendingAppt + pendingUrgent + pendingHyg) > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2 text-xs font-bold text-warning">
                <AlertTriangle size={14} />
                {pendingAppt + pendingUrgent + pendingHyg} требуют внимания
              </div>
            ) : null}
          </div>
        }
      />

      {/* Tabs */}
      <motion.div variants={fadeUp}>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                tab === t.id
                  ? 'bg-dv-gold/20 text-dv-gold'
                  : 'text-txt-muted hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-bold text-white">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Urgent tab */}
      {tab === 'urgent' && (
        <motion.div variants={fadeUp}>
          {renderReminderList(
            urgentReminders,
            'Нет срочных приёмов',
            'Нет записей в ближайшие 2 часа',
          )}
        </motion.div>
      )}

      {/* Appointments tab */}
      {tab === 'appointments' && (
        <motion.div variants={fadeUp}>
          {renderReminderList(
            appointmentReminders,
            'Нет ближайших приёмов',
            'Все записи на ближайшие 24 часа уже обработаны',
          )}
        </motion.div>
      )}

      {/* Hygiene tab */}
      {tab === 'hygiene' && (
        <motion.div variants={fadeUp}>
          {hygieneReminders.length === 0 ? (
            <EmptyState
              icon={<Smile size={28} />}
              title="Нет просроченных напоминаний"
              description="У всех пациентов профгигиена в норме (менее 6 мес.)"
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {hygieneReminders.map(r => (
                <Card key={r.id} className={r.sent ? 'opacity-55' : ''}>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3.5 flex-wrap">
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-white">{r.patient.name}</span>
                          {r.sent && <Badge variant="success" size="sm">Отправлено</Badge>}
                          {!r.sent && (
                            <Badge variant={r.monthsSince ? 'warning' : 'error'} size="sm">
                              {r.monthsSince ? `${r.monthsSince} мес. назад` : 'Никогда не было'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-txt-secondary">
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} /> {r.patient.phone}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Smile size={12} /> Последняя гигиена: {r.lastDate ? fd(r.lastDate) : 'нет данных'}
                          </span>
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<MessageSquare size={14} />}
                            onClick={() => handleSend(r)}
                          >
                            Отправить WhatsApp
                          </Button>
                          {!r.sent && (
                            <Button variant="outline" size="sm" onClick={() => handleMark(r)}>
                              Отметить
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'followups' && (
        <motion.div variants={fadeUp}>
          {followUps.length === 0 ? (
            <EmptyState
              icon={<Stethoscope size={28} />}
              title="Нет контрольных звонков"
              description="Появятся после закрытия приёмов с пометками: имплант, удаление, хирургия, швы…"
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {followUps.map((f) => (
                <Card key={f.id}>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3.5 flex-wrap">
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-white">{f.patientName}</span>
                          <Badge variant="warning" size="sm">{f.reason}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-txt-secondary">
                          <span className="inline-flex items-center gap-1"><Phone size={12} /> {f.phone || '—'}</span>
                          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {fd(f.date)}</span>
                        </div>
                        {f.notes && <p className="text-xs text-txt-muted mt-2 line-clamp-2">{f.notes}</p>}
                      </div>
                      {!readOnly && f.phone && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<MessageSquare size={14} />}
                          onClick={() => {
                            const link = buildWaLink(
                              f.phone,
                              `Здравствуйте, ${f.patientName}! Это клиника ${clinic?.name || ''}. Как самочувствие после приёма ${fd(f.date)}? Если есть вопросы — напишите нам.`,
                            )
                            window.open(link, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Info footer */}
      <motion.div variants={fadeUp} className="flex items-start gap-2 rounded-xl border border-bdr-subtle bg-white/[0.03] p-3.5 text-[11px] leading-relaxed text-txt-secondary">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Кнопка «Отправить WhatsApp» открывает чат с готовым текстом сообщения — просто нажмите «Отправить» в WhatsApp.
          Профгигиена определяется автоматически по завершённым приёмам и чекам с услугой «Гигиена».
        </span>
      </motion.div>
    </motion.div>
  );
}
