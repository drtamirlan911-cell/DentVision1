/**
 * Server-side reminder eligibility (mirrors src/utils/reminders.ts).
 */

const APPT_REMINDER_STATUSES = new Set(['pending', 'confirmed', 'scheduled', 'confirmed', 'pending', 'reminderSent']);

export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return digits;
}

export function isReminderEligibleDbStatus(status: string | undefined | null): boolean {
  return APPT_REMINDER_STATUSES.has(String(status || ''));
}

export function buildAppointmentReminderMessage(opts: {
  patientName: string;
  date: string;
  time: string;
  doctorName?: string;
  type?: string | null;
  clinicName?: string;
}): string {
  const { patientName, date, time, doctorName, type, clinicName } = opts;
  return [
    `Здравствуйте, ${patientName}!`,
    '',
    'Напоминаем о вашей записи:',
    `📅 ${date} в ${time}`,
    doctorName ? `👨‍⚕️ Врач: ${doctorName}` : null,
    type ? `📝 ${type}` : null,
    clinicName ? `🏥 ${clinicName}` : null,
    '',
    'Если не сможете прийти — сообщите заранее. Ждём вас!',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Appointments whose start is within [now+hoursMin, now+hoursWindow]. */
export function appointmentInWindow(
  date: Date,
  time: string | null | undefined,
  hoursWindow: number,
  hoursMin = 0,
  now = new Date(),
): boolean {
  const y = date.toISOString().slice(0, 10);
  const dt = new Date(`${y}T${time || '09:00'}`);
  if (Number.isNaN(dt.getTime())) return false;
  const start = new Date(now.getTime() + hoursMin * 3600 * 1000);
  const end = new Date(now.getTime() + hoursWindow * 3600 * 1000);
  return dt >= start && dt <= end;
}
