// ─────────────────────────────────────────────────────────────────────────────
// Event Bus (Phase 0) — in-process, typed domain events.
//
// Foundation for the event-driven architecture (BLUEPRINT.md §16): domain actions
// publish events; cross-cutting concerns (audit, notifications, analytics, and
// later webhooks / workflow triggers) subscribe instead of being called directly.
//
// In-process for now (single node). When horizontal scaling is needed this can be
// swapped for Redis Streams / a queue behind the same publish()/subscribe() API.
// ─────────────────────────────────────────────────────────────────────────────
import { EventEmitter } from 'node:events';

export interface DomainEventMap {
  'patient.created': { clinicId: string; patientId: string; userId?: string; name?: string };
  'patient.deleted': { clinicId: string; patientId: string; userId?: string };
  'appointment.created': { clinicId: string; appointmentId: string; userId?: string };
  'supplier.status_changed': { supplierId: string; status: string; from?: string; to?: string; userId?: string };
  'lecturer.level_changed': { lecturerId: string; level: string; from?: string; to?: string; userId?: string };
}

export type DomainEventName = keyof DomainEventMap;

const emitter = new EventEmitter();
// Many subscribers may attach over time; avoid the default 10-listener warning.
emitter.setMaxListeners(50);

/** Publish a domain event. Fire-and-forget: never throws into the caller. */
export function publish<E extends DomainEventName>(event: E, payload: DomainEventMap[E]): void {
  // Defer so publishing never blocks or fails the request path.
  setImmediate(() => {
    try {
      emitter.emit(event, payload);
    } catch (err) {
      console.error(`[events] emit failed for "${event}":`, err);
    }
  });
}

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
