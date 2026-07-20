// Registers all domain-event subscribers. Called once at startup (app.ts).
// Keeps cross-cutting side effects (audit, etc.) decoupled from route handlers.
import prisma from '../lib/prisma.js';
import { subscribe } from '../lib/events.js';
import { uid } from '../lib/helpers.js';

let registered = false;

export function registerSubscribers(): void {
  if (registered) return;
  registered = true;

  // Audit: record patient lifecycle events centrally via the event bus instead
  // of scattering audit writes across handlers.
  subscribe('patient.created', async ({ clinicId, patientId, userId, name }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: clinicId || null,
        action: 'patient.created',
        entity: 'patient',
        entityId: patientId,
        details: name ? { name } : undefined,
      },
    });
  });

  subscribe('patient.deleted', async ({ clinicId, patientId, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: clinicId || null,
        action: 'patient.deleted',
        entity: 'patient',
        entityId: patientId,
      },
    });
  });

  subscribe('appointment.created', async ({ clinicId, appointmentId, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: clinicId || null,
        action: 'appointment.created',
        entity: 'appointment',
        entityId: appointmentId,
      },
    });
  });

  subscribe('supplier.status_changed', async ({ supplierId, from, to, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: null,
        action: 'supplier.status_changed',
        entity: 'supplier',
        entityId: supplierId,
        details: { from, to },
      },
    });
  });

  subscribe('lecturer.level_changed', async ({ lecturerId, from, to, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: null,
        action: 'lecturer.level_changed',
        entity: 'lecturer',
        entityId: lecturerId,
        details: { from, to },
      },
    });
  });

  console.log('[events] subscribers registered');
}
