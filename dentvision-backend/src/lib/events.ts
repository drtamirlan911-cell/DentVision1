// ─────────────────────────────────────────────────────────────────────────────
// Event Bus (Phase 0) — in-process, typed domain events.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'node:events';

export type GrowthEventName =
  | 'USER_SIGNED_UP' | 'PROFILE_COMPLETED' | 'ORGANIZATION_CREATED' | 'CLINIC_CREATED'
  | 'FIRST_PATIENT_CREATED' | 'FIRST_CASE_CREATED' | 'FIRST_AI_ACTION' | 'FIRST_TREATMENT_PLAN_CREATED'
  | 'FIRST_APPOINTMENT_CREATED' | 'FIRST_DIAGNOSTIC_ORDER' | 'FIRST_LAB_ORDER' | 'FIRST_PAYMENT'
  | 'STAFF_INVITED' | 'PATIENT_PORTAL_SHARED' | 'TREATMENT_PLAN_SHARED' | 'TRIAL_STARTED'
  | 'PAYMENT_STARTED' | 'SUBSCRIPTION_STARTED' | 'PLAN_UPGRADED' | 'REFERRAL_CREATED'
  | 'REFERRAL_CONVERTED' | 'FEATURE_LIMIT_REACHED' | 'NEXT_BEST_ACTION_SHOWN' | 'NEXT_BEST_ACTION_COMPLETED';

export interface GrowthEventPayload {
  event: GrowthEventName; userId?: string; clinicId?: string; organizationId?: string; branchId?: string;
  entityId?: string; source?: string; metadata?: Record<string, unknown>; occurredAt?: string;
}

export interface DomainEventMap {
  'patient.created': { clinicId: string; patientId: string; userId?: string; name?: string };
  'patient.deleted': { clinicId: string; patientId: string; userId?: string };
  'appointment.created': { clinicId: string; appointmentId: string; patientId: string; doctorId: string | null; userId?: string };
  'supplier.status_changed': { supplierId: string; status: string; from?: string; to?: string; userId?: string };
  'lecturer.level_changed': { lecturerId: string; level: string; from?: string; to?: string; userId?: string };
  'referral.created': { referralId: string; clinicId: string; centerId: string; doctorId: string; patientName: string; studyType: string; status: string; userId?: string };
  'referral.accepted': { referralId: string; clinicId: string; centerId: string; doctorId: string; patientName: string; studyType: string; status: string; userId?: string; cost?: any; platformFee?: any };
  'referral.in_progress': { referralId: string; clinicId: string; centerId: string; doctorId: string; patientName: string; studyType: string; status: string; userId?: string; cost?: any; platformFee?: any };
  'referral.completed': { referralId: string; clinicId: string; centerId: string; doctorId: string; patientName: string; studyType: string; status: string; userId?: string; cost?: any; platformFee?: any };
  'diagnostics.result_ready': { referralId: string; resultId: string; clinicId: string; centerId: string; doctorId: string; patientName: string; studyType: string; userId?: string };
  'diagnostics.result_confirmed': { referralId: string; resultId: string; clinicId: string; centerId?: string; doctorId: string; userId?: string; confirmedBy?: string; confirmedAt?: string };
  'diagnostics.booking.created': { centerId: string; bookingId: string; studyId: string; patientName: string; date: string; time: string; status: string; userId?: string };
  'diagnostics.booking.status_changed': { centerId: string; bookingId: string; studyId: string; patientName: string; date: string; time: string; status: string; previousStatus?: string; userId?: string };
  'labOrder.created': { clinicId: string; labOrderId: string; patientId?: string; doctorId?: string; treatmentCaseId?: string; userId?: string };
  'labOrder.status_changed': { clinicId: string; labOrderId: string; patientId?: string; doctorId?: string; treatmentCaseId?: string; status: string; previousStatus?: string; userId?: string };
  'labOrder.assigned': { clinicId: string; labOrderId: string; laboratoryId: string; laboratoryName: string; patientId?: string; doctorId?: string; treatmentCaseId?: string; userId?: string };
  'medicalLabOrder.created': { orderId: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; labId?: string | null; userId?: string };
  'medicalLabOrder.status_changed': { orderId: string; clinicId: string; fromStatus: string; toStatus: string; userId?: string };
  'medicalLabResult.ready': { orderId: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; userId?: string };
  'medicalLabResult.verified': { orderId: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; userId?: string };
  'medicalLabResult.interpreted': { orderId: string; clinicId: string; patientId?: string | null; treatmentCaseId?: string | null; userId?: string; source?: string };
  'growth.event': GrowthEventPayload;
}

export type DomainEventName = keyof DomainEventMap;
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function publish<E extends DomainEventName>(event: E, payload: DomainEventMap[E]): void {
  setImmediate(() => { try { emitter.emit(event, payload); } catch (err) { console.error(`[events] emit failed for "${event}":`, err); } });
}

export function publishGrowthEvent(payload: GrowthEventPayload): void {
  publish('growth.event', { ...payload, occurredAt: payload.occurredAt ?? new Date().toISOString() });
}

export const emit = publish;

export function subscribe<E extends DomainEventName>(event: E, handler: (payload: DomainEventMap[E]) => void | Promise<void>): void {
  emitter.on(event, (payload: DomainEventMap[E]) => {
    Promise.resolve().then(() => handler(payload)).catch((err) => console.error(`[events] handler failed for "${event}":`, err));
  });
}

export const eventBus = { publish, publishGrowthEvent, subscribe };