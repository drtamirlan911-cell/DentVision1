import type { ClinicSettingsPayload } from '../clinics/clinicSettings.js';
import { DEFAULT_CLINIC_SETTINGS } from '../clinics/clinicSettings.js';

export interface SlotOccupancy {
  time: string;
  doctorId?: string | null;
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildTimeSlots(settings: ClinicSettingsPayload): string[] {
  const cfg = { ...DEFAULT_CLINIC_SETTINGS, ...settings };
  const step = cfg.bookingSlotMinutes || 30;
  const start = parseMinutes(cfg.workStart || '08:00');
  const end = parseMinutes(cfg.workEnd || '20:00');
  const lunchStart = cfg.lunchStart ? parseMinutes(cfg.lunchStart) : null;
  const lunchEnd = cfg.lunchEnd ? parseMinutes(cfg.lunchEnd) : null;

  const slots: string[] = [];
  for (let t = start; t < end; t += step) {
    if (lunchStart != null && lunchEnd != null && t >= lunchStart && t < lunchEnd) continue;
    slots.push(formatMinutes(t));
  }
  return slots;
}

export function isWorkingDay(date: Date, settings: ClinicSettingsPayload): boolean {
  const cfg = { ...DEFAULT_CLINIC_SETTINGS, ...settings };
  const workDays = cfg.workDays?.length ? cfg.workDays : [1, 2, 3, 4, 5, 6];
  const dow = date.getUTCDay();
  return workDays.includes(dow === 0 ? 7 : dow);
}

export function filterAvailableSlots(
  allSlots: string[],
  occupied: SlotOccupancy[],
  doctorId?: string | null,
  doctorCount = 1,
): string[] {
  if (doctorId) {
    const taken = new Set(
      occupied.filter((o) => o.doctorId === doctorId).map((o) => o.time),
    );
    return allSlots.filter((slot) => !taken.has(slot));
  }

  return allSlots.filter((slot) => {
    const atSlot = occupied.filter((o) => o.time === slot && o.doctorId);
    const busyDoctors = new Set(atSlot.map((o) => o.doctorId));
    return busyDoctors.size < Math.max(1, doctorCount);
  });
}

export function splitPatientName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Пациент', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
