import { parseMeta, type AppointmentMeta } from './appointmentMeta.js';

export type PayType = 'commission' | 'salary' | 'mixed';

export interface PayrollServiceLine {
  name: string;
  price: number;
  matCost: number;
}

export interface PayrollVisit {
  appointmentId: string;
  date: string;
  time: string | null;
  patientName?: string;
  services: PayrollServiceLine[];
  gross: number;
  matCost: number;
  net: number;
  earned: number;
}

export interface PayrollSummary {
  userId: string;
  name: string;
  role: string;
  percent: number;
  payType: PayType;
  baseSalary: number;
  salaryPart: number;
  commissionPart: number;
  visits: number;
  gross: number;
  matCost: number;
  net: number;
  /** Total to pay = salaryPart + commissionPart */
  earned: number;
  visitDetails: PayrollVisit[];
}

export function normalizePayType(raw?: string | null): PayType {
  const v = String(raw || 'commission').toLowerCase();
  if (v === 'salary' || v === 'оклад') return 'salary';
  if (v === 'mixed' || v === 'mix' || v === 'комби') return 'mixed';
  return 'commission';
}

/** Prorate monthly оклад across [from, to] (inclusive-ish calendar days). */
export function prorateBaseSalary(baseSalary: number, from: Date, to: Date): number {
  const base = Number(baseSalary) || 0;
  if (base <= 0) return 0;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  // Cap at one month equivalent so custom year ranges don't explode.
  const ratio = Math.min(1, days / 30);
  return Math.round(base * ratio);
}

export function appointmentRevenue(meta: AppointmentMeta): { gross: number; matCost: number; services: PayrollServiceLine[] } {
  const services: PayrollServiceLine[] = [];

  if (Array.isArray(meta.services) && meta.services.length > 0) {
    for (const row of meta.services) {
      services.push({
        name: String(row.name || 'Услуга'),
        price: Number(row.price) || 0,
        matCost: Number(row.matCost) || 0,
      });
    }
  } else if (meta.serviceName || meta.servicePrice) {
    services.push({
      name: String(meta.serviceName || 'Услуга'),
      price: Number(meta.servicePrice) || 0,
      matCost: Number(meta.matCost) || 0,
    });
  }

  const gross = services.reduce((sum, s) => sum + s.price, 0);
  const matCost = services.reduce((sum, s) => sum + s.matCost, 0);
  return { gross, matCost, services };
}

export function buildDoctorPayroll(input: {
  userId: string;
  name: string;
  role: string;
  percent: number;
  baseSalary?: number;
  payType?: string | null;
  from?: Date;
  to?: Date;
  appointments: Array<{
    id: string;
    date: Date;
    time: string | null;
    meta?: unknown;
    patient?: { firstName: string; lastName: string } | null;
  }>;
}): PayrollSummary {
  const payType = normalizePayType(input.payType);
  const percent = payType === 'salary' ? 0 : Number(input.percent) || 0;
  const visitDetails: PayrollVisit[] = [];
  let gross = 0;
  let matCost = 0;

  if (payType !== 'salary') {
    for (const appt of input.appointments) {
      const meta = parseMeta(appt.meta);
      const revenue = appointmentRevenue(meta);
      if (revenue.gross <= 0 && revenue.matCost <= 0) continue;

      const net = Math.max(0, revenue.gross - revenue.matCost);
      const earned = Math.round(net * (percent / 100));
      gross += revenue.gross;
      matCost += revenue.matCost;

      visitDetails.push({
        appointmentId: appt.id,
        date: appt.date instanceof Date ? appt.date.toISOString().slice(0, 10) : String(appt.date).slice(0, 10),
        time: appt.time,
        patientName: appt.patient
          ? `${appt.patient.firstName} ${appt.patient.lastName}`.trim()
          : undefined,
        services: revenue.services,
        gross: revenue.gross,
        matCost: revenue.matCost,
        net,
        earned,
      });
    }
  }

  const net = Math.max(0, gross - matCost);
  const commissionPart = payType === 'salary' ? 0 : Math.round(net * (percent / 100));
  const from = input.from || new Date();
  const to = input.to || new Date();
  const salaryPart =
    payType === 'commission'
      ? 0
      : prorateBaseSalary(Number(input.baseSalary) || 0, from, to);

  return {
    userId: input.userId,
    name: input.name,
    role: input.role,
    percent,
    payType,
    baseSalary: Number(input.baseSalary) || 0,
    salaryPart,
    commissionPart,
    visits: visitDetails.length,
    gross,
    matCost,
    net,
    earned: salaryPart + commissionPart,
    visitDetails: visitDetails.sort(
      (a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')),
    ),
  };
}

export function aggregateServicesFromBody(body: Record<string, unknown>): PayrollServiceLine[] {
  const services = Array.isArray(body.services) ? body.services : [];
  if (services.length > 0) {
    return services.map((row: any) => ({
      name: String(row?.name || 'Услуга'),
      price: Number(row?.price) || 0,
      matCost: Number(row?.matCost) || 0,
    }));
  }

  if (body.serviceName || body.servicePrice) {
    return [{
      name: String(body.serviceName || 'Услуга'),
      price: Number(body.servicePrice) || 0,
      matCost: Number(body.matCost) || 0,
    }];
  }

  return [];
}

export function metaFromClosedVisit(
  existing: AppointmentMeta,
  body: Record<string, unknown>,
): AppointmentMeta {
  const services = aggregateServicesFromBody(body);
  const gross = services.reduce((sum, s) => sum + s.price, 0);
  const matCost = services.reduce((sum, s) => sum + s.matCost, 0);
  const primary = services[0];

  return {
    ...existing,
    services,
    serviceName: primary?.name || existing.serviceName,
    servicePrice: gross,
    matCost,
    paymentStatus: body.paymentStatus ? String(body.paymentStatus) : existing.paymentStatus || 'unpaid',
    diagnosis: body.diagnosis !== undefined ? String(body.diagnosis) : existing.diagnosis,
    toothNumber: body.toothNumber !== undefined ? body.toothNumber as string | number : existing.toothNumber,
  };
}
