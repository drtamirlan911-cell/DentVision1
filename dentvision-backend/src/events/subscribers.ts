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

  // Platform-level (not clinic-scoped) — no audit trail existed for either
  // until now. `referral.*` / `diagnostics.result_ready` deliberately have no
  // subscriber here: `diagnostics.service.ts` already writes its own
  // `writeAuditLog` row and sends its own notification at the call site for
  // each of those; a second write here would just duplicate the log entry.
  // What those four *were* missing is `registerWorkflowEngine()` being
  // called at all (see app.ts) — this file was never the gap for them.
  subscribe('supplier.status_changed', async ({ supplierId, from, to, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: null,
        action: 'supplier.status_changed',
        entity: 'supplier',
        entityId: supplierId,
        details: { from: from || null, to: to || null },
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
        details: { from: from || null, to: to || null },
      },
    });
  });

  // Unlike referral/diagnostics, lab.routes.ts never wrote its own audit row —
  // lab order lifecycle had no audit trail at all until these two.
  subscribe('labOrder.created', async ({ clinicId, labOrderId, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: clinicId || null,
        action: 'labOrder.created',
        entity: 'labOrder',
        entityId: labOrderId,
      },
    });
  });

  subscribe('labOrder.status_changed', async ({ clinicId, labOrderId, status, previousStatus, userId }) => {
    await prisma.auditLog.create({
      data: {
        id: uid(),
        userId: userId || null,
        clinicId: clinicId || null,
        action: 'labOrder.status_changed',
        entity: 'labOrder',
        entityId: labOrderId,
        details: { from: previousStatus || null, to: status },
      },
    });
  });

  console.log('[events] subscribers registered');
}
