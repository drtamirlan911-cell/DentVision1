import prisma from '../lib/prisma.js';
import { createHash } from 'node:crypto';
import { subscribe } from '../lib/events.js';
import { eventBus as aiEventBus } from '../modules/events/index.js';
import { EventType } from '../modules/events/EventTypes.js';

let registered = false;

function diagnosticResultNotificationId(resultId: string, doctorId: string): string {
  return `diag_result_${createHash('sha256').update(`${resultId}:${doctorId}`).digest('hex').slice(0, 35)}`;
}

function labOrderNotificationId(labOrderId: string, doctorId: string): string {
  return `lab_ready_${createHash('sha256').update(`${labOrderId}:${doctorId}`).digest('hex').slice(0, 35)}`;
}

/** Bridge CRM and operational domain events into the durable AI Event OS without blocking requests. */
export function registerAIEventBridge(): void {
  if (registered) return;
  registered = true;

  subscribe('patient.created', async ({ clinicId, patientId, userId, name }) => {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId }, select: { medicalHistory: true, notes: true } });
    const history = patient?.medicalHistory && typeof patient.medicalHistory === 'object' ? patient.medicalHistory as Record<string, unknown> : {};
    const raw = history.complaints ?? history.chiefComplaint ?? patient?.notes;
    const complaints = raw ? (Array.isArray(raw) ? raw.map(String).slice(0, 12) : [String(raw).slice(0, 500)]) : [];
    await aiEventBus.publish(EventType.PatientCreated, {
      patientId,
      firstName: name?.split(/\s+/)[0] || 'Пациент',
      lastName: name?.split(/\s+/).slice(1).join(' ') || '',
      ...(complaints.length ? { complaints } : {}),
    }, { clinicId, userId: userId || 'system', source: 'crm.patient.created' });
  });

  subscribe('patient.deleted', async ({ clinicId, patientId, userId }) => {
    await aiEventBus.publish(EventType.PatientDeleted, { patientId }, { clinicId, userId: userId || 'system', source: 'crm.patient.deleted' });
  });

  subscribe('appointment.created', async ({ clinicId, appointmentId, patientId, doctorId, userId }) => {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId }, select: { date: true, time: true, type: true } });
    await aiEventBus.publish(EventType.AppointmentBooked, {
      appointmentId, patientId, doctorId: doctorId || '',
      date: appointment?.date?.toISOString().slice(0, 10) || '', time: appointment?.time || '', type: appointment?.type || '',
    }, { clinicId, userId: userId || doctorId || 'system', source: 'crm.appointment.created' });
  });

  subscribe('labOrder.created', async ({ clinicId, labOrderId, patientId, doctorId, userId }) => {
    const order = await prisma.labOrder.findFirst({ where: { id: labOrderId, clinicId }, select: { status: true } });
    await aiEventBus.publish(EventType.LabOrderCreated, { labOrderId, patientId: patientId || '', doctorId: doctorId || '', status: order?.status || 'pending' }, { clinicId, userId: userId || doctorId || 'system', source: 'crm.labOrder.created' });
  });

  subscribe('labOrder.status_changed', async ({ clinicId, labOrderId, patientId, doctorId, status, previousStatus, userId }) => {
    if (!['completed', 'delivered', 'ready'].includes(status)) return;
    const order = await prisma.labOrder.findFirst({
      where: { id: labOrderId, clinicId },
      select: { status: true, doctorId: true, patientId: true },
    });
    const targetDoctorId = doctorId || order?.doctorId || undefined;

    // Deliver a durable in-app notification to the responsible doctor. The AI event
    // itself contains only routing metadata; laboratory files/results stay protected.
    if (targetDoctorId) {
      const doctorMembership = await prisma.clinicMember.findFirst({
        where: { clinicId, userId: targetDoctorId, role: 'DOCTOR' },
        select: { userId: true },
      });
      if (doctorMembership) {
        const notificationId = labOrderNotificationId(labOrderId, targetDoctorId);
        await prisma.notification.upsert({
          where: { id: notificationId },
          create: {
            id: notificationId,
            userId: targetDoctorId,
            type: 'workflow',
            title: 'Лабораторный заказ готов',
            message: 'Лабораторный заказ готов к просмотру.',
            link: `/lab?order=${encodeURIComponent(labOrderId)}`,
          },
          update: {
            title: 'Лабораторный заказ готов',
            message: 'Лабораторный заказ готов к просмотру.',
            link: `/lab?order=${encodeURIComponent(labOrderId)}`,
            read: false,
          },
        });
      }
    }

    await aiEventBus.publish(EventType.LabOrderCompleted, {
      labOrderId,
      patientId: patientId || order?.patientId || '',
      doctorId: targetDoctorId || '',
      status: order?.status || status,
      previousStatus,
    }, { clinicId, userId: userId || targetDoctorId || 'system', source: 'crm.labOrder.status_changed' });
  });

  subscribe('diagnostics.result_ready', async ({ referralId, resultId, clinicId, centerId, doctorId, patientName, studyType, userId }) => {
    // Enforce the clinic boundary before delivering the proactive notification.
    // The AI Event OS receives routing metadata only; report text/files remain in the protected referral API.
    if (doctorId) {
      const doctorMembership = await prisma.clinicMember.findFirst({
        where: { clinicId, userId: doctorId, role: 'DOCTOR' },
        select: { userId: true },
      });

      if (doctorMembership) {
        await prisma.notification.upsert({
          where: { id: diagnosticResultNotificationId(resultId, doctorId) },
          create: {
            id: diagnosticResultNotificationId(resultId, doctorId),
            userId: doctorId,
            type: 'workflow',
            title: 'Результат диагностики готов',
            message: `${studyType || 'Исследование'} по направлению готово к просмотру.`,
            link: `/diagnostics/referrals/${referralId}`,
          },
          update: {
            title: 'Результат диагностики готов',
            message: `${studyType || 'Исследование'} по направлению готово к просмотру.`,
            link: `/diagnostics/referrals/${referralId}`,
            read: false,
          },
        });
      }
    }

    await aiEventBus.publish(EventType.DiagnosticResultReady, {
      referralId,
      resultId,
      centerId,
      doctorId,
      patientName,
      studyType,
    }, { clinicId, userId: userId || doctorId || 'system', source: 'diagnostics.result_ready' });
  });

  subscribe('diagnostics.booking.created', async ({ centerId, bookingId, studyId, patientName, date, time, status, userId }) => {
    await aiEventBus.publish(EventType.DiagnosticBookingCreated, {
      bookingId, centerId, studyId, patientName, date, time, status,
    }, { clinicId: centerId, userId: userId || 'system', source: 'diagnostics.booking.created' });
  });

  subscribe('diagnostics.booking.status_changed', async ({ centerId, bookingId, studyId, patientName, date, time, status, previousStatus, userId }) => {
    await aiEventBus.publish(EventType.DiagnosticBookingStatusChanged, {
      bookingId, centerId, studyId, patientName, date, time, status, previousStatus,
    }, { clinicId: centerId, userId: userId || 'system', source: 'diagnostics.booking.status_changed' });
  });

  console.log('[events] AI Event OS bridge registered');
}
