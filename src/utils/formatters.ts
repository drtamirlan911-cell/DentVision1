import type { Appointment, Clinic } from '../types'

export function today(): string {
  return new Date().toISOString().slice(0,10);
}

export function fd(d: string): string {
  if(!d) return "";
  const [y,m,day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function ft(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h}:${m}`;
}

export const CIS_CURRENCY_BY_COUNTRY = {
  KZ: { currency: "KZT", locale: "ru-KZ" },
  RU: { currency: "RUB", locale: "ru-RU" },
  KG: { currency: "KGS", locale: "ru-KG" },
  UZ: { currency: "UZS", locale: "ru-UZ" },
  TJ: { currency: "TJS", locale: "ru-TJ" },
  AZ: { currency: "AZN", locale: "az-AZ" },
  AM: { currency: "AMD", locale: "hy-AM" },
  BY: { currency: "BYN", locale: "ru-BY" },
  MD: { currency: "MDL", locale: "ro-MD" },
} as const;

export function getClinicCurrency(clinic: Clinic | null | undefined): { currency: string; locale: string } {
  const countryDefaults = CIS_CURRENCY_BY_COUNTRY[clinic?.country as keyof typeof CIS_CURRENCY_BY_COUNTRY];
  return {
    currency: clinic?.currency || countryDefaults?.currency || "KZT",
    locale: clinic?.locale || countryDefaults?.locale || "ru-KZ",
  };
}

export function formatMoney(n: number | string, clinicOrCurrency: string | Clinic): string {
  const settings = typeof clinicOrCurrency === "string"
    ? { currency: clinicOrCurrency, locale: "ru-RU" }
    : getClinicCurrency(clinicOrCurrency);
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function tg(n: number | string, clinicOrCurrency: string | Clinic): string {
  return formatMoney(n, clinicOrCurrency);
}

export function gid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}

export function calculateAge(dob: string): string | number {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("7")) {
    return `+7 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7,9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

export function getNextAvailableSlot(appointments: Appointment[], date: string, doctorId: string): string | null {
  const dayAppts = appointments.filter(a => a.date === date && a.doctorId === doctorId && a.status !== "cancelled");
  const bookedTimes = dayAppts.map(a => a.time);
  const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"];
  return HOURS.find(h => !bookedTimes.includes(h)) || null;
}

export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().slice(0, 10);
}

export function getMonthStart(dateStr: string): string {
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { day: 'numeric', month: 'long' };
  return `${startDate.toLocaleDateString('ru-RU', options)} — ${endDate.toLocaleDateString('ru-RU', options)}`;
}
