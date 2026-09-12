// Registers all domain-event subscribers. Called once at startup (app.ts).
// Keeps cross-cutting side effects (audit, AI automation, etc.) decoupled from route handlers.
import prisma from '../lib/prisma.js';
import { subscribe } from '../lib/events.js';
import { uid } from '../lib/helpers.js';
import { ensurePatientAssignment } from '../lib/patientAssignment.js';
import { applyCanonicalReferralEconomics } from '../modules/finance/referral-economics.service.js';
import { recordDentalLabOrderEconomics } from '../modules/finance/dental-lab-economics.service.js';
import { registerAIEventBridge } from './aiEventBridge.js';

let registered = false;

export function registerSubscribers(): void {
  if (registered) return;
  registered = true;
  registerAIEventBridge();

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

  subscribe('appointment.created', async ({ clinicId, patientId, doctorId }) => {
    await ensurePatientAssignment({ clinicId, patientId, userId: doctorId });
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

  subscribe('labOrder.status_changed', async ({ labOrderId, status }) => {
    if (status !== 'delivered') return;
    await recordDentalLabOrderEconomics(labOrderId);
  });

  const reconcileReferralEconomics = async ({ referralId }: { referralId: string }) => {
    await applyCanonicalReferralEconomics(referralId);
  };

  // Referral handlers historically wrote a flat 10% fee. These lifecycle
  // subscribers immediately reconcile that derived field with the canonical,
  // versioned economics engine. The durable economics ledger remains created
  // at settlement, so a pre-payment rule correction cannot create a duplicate
  // historical transaction.
  subscribe('referral.accepted', reconcileReferralEconomics);
  subscribe('referral.in_progress', reconcileReferralEconomics);

  console.log('[events] subscribers registered');
}
