/**
 * Clinic settings helpers — OWNER / ADMIN (Руководитель / Администратор) only.
 */

import {
  DEFAULT_CLINIC_PAYMENTS,
  mergeClinicPayments,
  publicClinicPayments,
  readClinicPayments,
  type ClinicPaymentsConfig,
  type ClinicPaymentsPublic,
} from '../payments/clinicPayments.js';

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
  /** KazDent donor: "Перчатки:1, Маска:1, Слюноотсос:1" */
  autoDeductItems?: string;
  /** Public online booking link (Instagram / 2GIS) */
  bookingLink?: string;
  /** Allow patients to book online via /book/:clinicId */
  onlineBookingEnabled?: boolean;
  /**
   * Per-clinic Kaspi / bank for CRM cashier.
   * Money goes to the clinic merchant — not DentVision platform.
   */
  payments?: ClinicPaymentsConfig | ClinicPaymentsPublic;
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
  autoDeductItems: '',
  bookingLink: '',
  onlineBookingEnabled: true,
  payments: { ...DEFAULT_CLINIC_PAYMENTS },
};

export function mergeClinicSettings(
  raw: unknown,
  incoming?: ClinicSettingsPayload,
): ClinicSettingsPayload {
  const base = { ...DEFAULT_CLINIC_SETTINGS };
  const rawObj = raw && typeof raw === 'object' ? (raw as ClinicSettingsPayload) : {};
  const merged: ClinicSettingsPayload = { ...base, ...rawObj };
  if (incoming) {
    const { payments: incomingPayments, ...rest } = incoming;
    Object.assign(merged, rest);
    if (incomingPayments !== undefined) {
      merged.payments = mergeClinicPayments(
        { payments: readClinicPayments(raw) },
        incomingPayments as ClinicPaymentsConfig,
      );
    } else {
      merged.payments = readClinicPayments(raw);
    }
  } else {
    merged.payments = readClinicPayments(raw);
  }
  return merged;
}

/** Strip secrets before sending settings to the browser. */
export function publicClinicSettings(
  raw: unknown,
  clinicId?: string,
): ClinicSettingsPayload {
  const merged = mergeClinicSettings(raw);
  const cfg = readClinicPayments(raw);
  return {
    ...merged,
    payments: publicClinicPayments(cfg, clinicId),
  };
}
