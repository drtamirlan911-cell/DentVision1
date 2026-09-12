// ─────────────────────────────────────────────────────────────────────────────
// Event Bus (Phase 0) — in-process, typed domain events.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'node:events';

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
  'diagnostics.booking.created': { centerId: string; bookingId: string; studyId: string; patientName: string; date: string; time: string; status: string; userId?: string };
  'diagnostics.booking.status_changed': { centerId: string; bookingId: string; studyId: string; patientName: string; date: string; time: string; status: string; previousStatus?: string; userId?: string };
  'labOrder.created': { clinicId: string; labOrderId: string; patientId?: string; doctorId?: string; userId?: string };
  'labOrder.status_changed': { clinicId: string; labOrderId: string; patientId?: string; doctorId?: string; status: string; previousStatus?: string; userId?: string };
  'labOrder.assigned': { clinicId: string; labOrderId: string; laboratoryId: string; laboratoryName: string; patientId?: string; doctorId?: string; userId?: string };
}

export type DomainEventName = keyof DomainEventMap;

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

/** Publish a domain event. Fire-and-forget: never throws into the caller. */
export function publish<E extends DomainEventName>(event: E, payload: DomainEventMap[E]): void {
  setImmediate(() => {
    try {
      emitter.emit(event, payload);
    } catch (err) {
      console.error(`[events] emit failed for "${event}":`, err);
    }
  });
}

/** Backward-compatible alias used by lightweight domain publishers. */
export const emit = publish;

/** Subscribe to a domain event. Handler errors are isolated and logged. */
export function subscribe<E extends DomainEventName>(
  event: E,
  handler: (payload: DomainEventMap[E]) => void | Promise<void>,
): void {
  emitter.on(event, (payload: DomainEventMap[E]) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => console.error(`[events] handler failed for "${event}":`, err));
  });
}

export const eventBus = { publish, subscribe };
