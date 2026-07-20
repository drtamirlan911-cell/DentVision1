import type { AppointmentStatus } from '@prisma/client';

export interface AppointmentMeta {
  serviceName?: string;
  servicePrice?: number;
  paymentStatus?: 'unpaid' | 'paid' | string;
  diagnosis?: string;
  toothNumber?: string | number;
  receiptId?: string;
  reason?: string;
}

const TO_DB: Record<string, AppointmentStatus> = {
  scheduled: 'PENDING',
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  remindersent: 'CONFIRMED',
  reminderSent: 'CONFIRMED',
  arrived: 'CONFIRMED',
  in_chair: 'CONFIRMED',
  done: 'COMPLETED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  noshow: 'NO_SHOW',
  noShow: 'NO_SHOW',
  NO_SHOW: 'NO_SHOW',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const FROM_DB: Record<AppointmentStatus, string> = {
  PENDING: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
  NO_SHOW: 'noShow',
};

export function toDbStatus(status?: string | null): AppointmentStatus {
  if (!status) return 'PENDING';
  return TO_DB[status] || TO_DB[status.toLowerCase()] || 'PENDING';
}

export function fromDbStatus(status: AppointmentStatus): string {
  return FROM_DB[status] || 'scheduled';
}

export function parseMeta(raw: unknown): AppointmentMeta {
  if (!raw || typeof raw !== 'object') return {};
  return raw as AppointmentMeta;
}

export function buildMeta(body: Record<string, unknown>, existing?: AppointmentMeta): AppointmentMeta {
  const base = { ...(existing || {}) };
  const keys: (keyof AppointmentMeta)[] = [
    'serviceName', 'servicePrice', 'paymentStatus', 'diagnosis', 'toothNumber', 'receiptId', 'reason',
  ];
  for (const key of keys) {
    if (body[key] !== undefined) (base as any)[key] = body[key];
  }
  if (body.service && !base.serviceName) base.serviceName = String(body.service);
  if (body.serviceId && !base.reason) base.reason = String(body.serviceId);
  return base;
}

export function serializeAppointment(row: {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  date: Date;
  time: string | null;
  duration: number | null;
  status: AppointmentStatus;
  type: string | null;
  notes: string | null;
  meta?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  patient?: { id: string; firstName: string; lastName: string; phone: string | null } | null;
}) {
  const meta = parseMeta(row.meta);
  const patientName = row.patient
    ? `${row.patient.firstName} ${row.patient.lastName}`.trim()
    : undefined;
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    time: row.time || '09:00',
    duration: row.duration ?? 30,
    status: fromDbStatus(row.status),
    type: row.type,
    notes: row.notes || '',
    service: meta.serviceName || row.type || '',
    serviceName: meta.serviceName || row.type || '',
    servicePrice: meta.servicePrice ?? 0,
    paymentStatus: meta.paymentStatus || 'unpaid',
    diagnosis: meta.diagnosis || '',
    toothNumber: meta.toothNumber ?? '',
    receiptId: meta.receiptId,
    reason: meta.reason || meta.serviceName || row.type || '',
    patientName,
    patientPhone: row.patient?.phone || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Overlap: same doctor, same calendar day, overlapping time windows. */
export function timesOverlap(
  aTime: string,
  aDuration: number,
  bTime: string,
  bDuration: number,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const a0 = toMin(aTime);
  const a1 = a0 + (aDuration || 30);
  const b0 = toMin(bTime);
  const b1 = b0 + (bDuration || 30);
  return a0 < b1 && b0 < a1;
}
