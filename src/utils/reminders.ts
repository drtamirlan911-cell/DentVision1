// ═══════════════════════════════════════════════════════════════════
// PATIENT REMINDERS ENGINE — WhatsApp click-to-send + hygiene tracking
// ═══════════════════════════════════════════════════════════════════

import type { Appointment, Patient, Receipt } from '../types';

const SENT_KEY = 'dv_reminders_sent_v1';

interface SentLog {
  [reminderId: string]: string;
}

function loadSentLog(): SentLog {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSentLog(log: SentLog): void {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

export function isSent(reminderId: string): boolean {
  const log = loadSentLog();
  return !!log[reminderId];
}

export function markSent(reminderId: string): void {
  const log = loadSentLog();
  log[reminderId] = new Date().toISOString();
  saveSentLog(log);
}

export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits;
}

export function buildWaLink(phone: string | undefined | null, message: string): string {
  const num = normalizePhone(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

const HYGIENE_RE = /гигиен/i;

interface AppointmentReminder {
  id: string;
  type: 'appointment';
  appointment: Appointment;
  patient: Patient;
  doctor: Patient | undefined;
  dueAt: Date;
  message: string;
  waLink: string;
  sent: boolean;
}

interface HygieneReminder {
  id: string;
  type: 'hygiene';
  patient: Patient;
  lastDate: string | null;
  monthsSince: number | null;
  daysSince: number;
  message: string;
  waLink: string;
  sent: boolean;
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ── Appointment reminders: scheduled visits happening within next N hours ──
export function getAppointmentReminders(appointments: Appointment[], patients: Patient[], doctors: Patient[], hoursWindow = 24): AppointmentReminder[] {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + hoursWindow * 3600 * 1000);

  return appointments
    .filter(a => a.status === 'scheduled')
    .map(a => {
      const dt = new Date(`${a.date}T${a.time || '00:00'}`);
      return { a, dt };
    })
    .filter(({ dt }) => dt >= now && dt <= windowEnd)
    .map(({ a, dt }) => {
      const patient = patients.find(p => p.id === a.patientId);
      const doctor = doctors.find(d => d.id === a.doctorId);
      if (!patient) return null;
      const id = `appt_${a.id}`;
      const message = `Здравствуйте, ${patient.name}!\n\nНапоминаем о вашей записи:\n📅 ${a.date} в ${a.time}\n👨‍⚕️ Врач: ${doctor?.name || a.doctorName || '—'}\n${a.reason ? `📝 ${a.reason}\n` : ''}\nЕсли не сможете прийти — сообщите заранее. Ждём вас!`;
      return {
        id, type: 'appointment', appointment: a, patient, doctor,
        dueAt: dt, message,
        waLink: buildWaLink(patient.phone, message),
        sent: isSent(id),
      };
    })
    .filter((r): r is AppointmentReminder => r !== null)
    .sort((x, y) => x.dueAt.getTime() - y.dueAt.getTime());
}

// ── Hygiene reminders: patients with no professional cleaning in N months ──
export function getHygieneReminders(patients: Patient[], appointments: Appointment[], receipts: Receipt[], monthsThreshold = 6): HygieneReminder[] {
  const thresholdDays = monthsThreshold * 30;

  return patients
    .map(p => {
      const events = [
        ...appointments.filter(a => a.patientId === p.id && a.status === 'done' && HYGIENE_RE.test(a.reason || '')),
        ...receipts.filter(r => r.patientId === p.id && (r.items || []).some(i => HYGIENE_RE.test(i.name || ''))),
      ];
      const dates = events.map(e => e.date).filter(Boolean).sort();
      const lastDate = dates.length ? dates[dates.length - 1] : null;
      const daysSince = lastDate ? daysBetween(lastDate) : Infinity;

      if (daysSince < thresholdDays) return null;

      const id = `hyg_${p.id}`;
      const monthsSince = lastDate ? Math.floor(daysSince / 30) : null;
      const message = lastDate
        ? `Здравствуйте, ${p.name}!\n\nПрошло уже ${monthsSince} мес. с последней профессиональной гигиены полости рта. Рекомендуем записаться на чистку для здоровья ваших зубов и дёсен 🦷✨\n\nЗапишитесь удобным способом — ответьте на это сообщение!`
        : `Здравствуйте, ${p.name}!\n\nРекомендуем пройти профессиональную гигиену полости рта — это важно для профилактики кариеса и заболеваний дёсен. Запишитесь на удобное время! 🦷✨`;

      return {
        id, type: 'hygiene', patient: p,
        lastDate, monthsSince, daysSince,
        message,
        waLink: buildWaLink(p.phone, message),
        sent: isSent(id),
      };
    })
    .filter((r): r is HygieneReminder => r !== null)
    .sort((a, b) => b.daysSince - a.daysSince);
}

export function getAllReminders(data: {
  appointments?: Appointment[];
  patients?: Patient[];
  doctors?: Patient[];
  receipts?: Receipt[];
}): { appointmentReminders: AppointmentReminder[]; hygieneReminders: HygieneReminder[] } {
  const { appointments = [], patients = [], doctors = [], receipts = [] } = data;
  const appt = getAppointmentReminders(appointments, patients, doctors);
  const hyg = getHygieneReminders(patients, appointments, receipts);
  return { appointmentReminders: appt, hygieneReminders: hyg };
}

export function getPendingCount(data: {
  appointments?: Appointment[];
  patients?: Patient[];
  doctors?: Patient[];
  receipts?: Receipt[];
}): number {
  const { appointmentReminders, hygieneReminders } = getAllReminders(data);
  return [...appointmentReminders, ...hygieneReminders].filter(r => !r.sent).length;
}
