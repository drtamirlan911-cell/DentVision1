import { subscribe } from '../lib/events.js';
import { eventBus as aiEventBus } from '../modules/events/index.js';
import { EventType } from '../modules/events/EventTypes.js';

let registered = false;

/**
 * Bridges the reliable domain-event layer used by CRM routes into the AI
 * Event OS. Domain events stay fire-and-forget for request latency; the AI
 * bus persists them and feeds EventOrchestrator.
 */
export function registerAIEventBridge(): void {
  if (registered) return;
  registered = true;

  subscribe('patient.created', async ({ clinicId, patientId, userId, name }) => {
    await aiEventBus.publish(
      EventType.PatientCreated,
      { patientId, firstName: name?.split(/\s+/)[0] || 'Пациент', lastName: name?.split(/\s+/).slice(1).join(' ') || '', },
      { clinicId, userId: userId || 'system', source: 'crm.patient.created' },
    );
  });

  subscribe('patient.deleted', async ({ clinicId, patientId, userId }) => {
    await aiEventBus.publish(
      EventType.PatientDeleted,
      { patientId },
      { clinicId, userId: userId || 'system', source: 'crm.patient.deleted' },
    );
  });

  subscribe('appointment.created', async ({ clinicId, appointmentId, patientId, doctorId, userId }) => {
    await aiEventBus.publish(
      EventType.AppointmentBooked,
      { appointmentId, patientId, doctorId: doctorId || '', date: '', time: '' },
      { clinicId, userId: userId || doctorId || 'system', source: 'crm.appointment.created' },
    );
  });

  subscribe('labOrder.created', async ({ clinicId, labOrderId, patientId, doctorId, userId }) => {
    await aiEventBus.publish(
      EventType.LabOrderCreated,
      { labOrderId, patientId: patientId || '', doctorId: doctorId || '' },
      { clinicId, userId: userId || doctorId || 'system', source: 'crm.labOrder.created' },
    );
  });

  subscribe('labOrder.status_changed', async ({ clinicId, labOrderId, patientId, doctorId, status, previousStatus, userId }) => {
    if (!['completed', 'delivered', 'ready'].includes(status)) return;
    await aiEventBus.publish(
      EventType.LabOrderCompleted,
      { labOrderId, patientId: patientId || '', doctorId: doctorId || '', status, previousStatus },
      { clinicId, userId: userId || doctorId || 'system', source: 'crm.labOrder.status_changed' },
    );
  });

  console.log('[events] AI Event OS bridge registered');
}
