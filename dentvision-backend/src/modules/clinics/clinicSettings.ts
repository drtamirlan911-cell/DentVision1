/**
 * Clinic settings helpers — OWNER / ADMIN (Руководитель / Администратор) only.
 */

export const CLINIC_SETTINGS_ROLES = ['OWNER', 'ADMIN'] as const;

export function canManageClinicSettings(role: string | undefined | null): boolean {
  const r = String(role || '').toUpperCase();
  // Frontend director maps to OWNER; cashier retired → treat as ADMIN if lingering.
  return r === 'OWNER' || r === 'ADMIN' || r === 'DIRECTOR';
}

export interface ClinicSettingsPayload {
  timezone?: string;
  currency?: string;
  locale?: string;
  workStart?: string;
  workEnd?: string;
  workDays?: number[];
  lunchStart?: string;
  lunchEnd?: string;
  reminderHours?: number;
  reminderUrgentHours?: number;
  hygieneMonths?: number;
  bookingSlotMinutes?: number;
  overbookingAllowed?: boolean;
  whatsappEnabled?: boolean;
  smsEnabled?: boolean;
  defaultAppointmentDuration?: number;
  invoicePrefix?: string;
  taxPercent?: number;
  notifyNoShow?: boolean;
  requireChair?: boolean;
}

export const DEFAULT_CLINIC_SETTINGS: ClinicSettingsPayload = {
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  locale: 'ru-KZ',
  workStart: '08:00',
  workEnd: '20:00',
  workDays: [1, 2, 3, 4, 5, 6],
  lunchStart: '12:00',
  lunchEnd: '13:00',
  reminderHours: 24,
  reminderUrgentHours: 2,
  hygieneMonths: 6,
  bookingSlotMinutes: 30,
  overbookingAllowed: false,
  whatsappEnabled: true,
  smsEnabled: false,
  defaultAppointmentDuration: 60,
  invoicePrefix: 'DV',
  taxPercent: 0,
  notifyNoShow: true,
  requireChair: false,
};

export function mergeClinicSettings(raw: unknown): ClinicSettingsPayload {
  const base = { ...DEFAULT_CLINIC_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...(raw as ClinicSettingsPayload) };
}
