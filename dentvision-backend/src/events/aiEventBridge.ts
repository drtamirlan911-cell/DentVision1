import prisma from '../lib/prisma.js';
import { decryptMedicalHistory } from '../lib/phi.js';
import { createHash } from 'node:crypto';
import { subscribe } from '../lib/events.js';
import { eventBus as aiEventBus } from '../modules/events/index.js';
import { EventType, type PatientCreatedPayload } from '../modules/events/EventTypes.js';

let registered = false;

function diagnosticResultNotificationId(resultId: string, doctorId: string): string {
  return `diag_result_${createHash('sha256').update(`${resultId}:${doctorId}`).digest('hex').slice(0, 35)}`;
}

function labOrderNotificationId(labOrderId: string, userId: string): string {
  return `lab_ready_${createHash('sha256').update(`${labOrderId}:${userId}`).digest('hex').slice(0, 35)}`;
}

/** Bridge CRM and operational domain events into the durable AI Event OS without blocking requests. */
export function registerAIEventBridge(): void {
  if (registered) return;
  registered = true;

  subscribe('patient.created', async ({ clinicId, patientId, userId }) => {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId }, select: { medicalHistory: true, notes: true } });
    const decodedHistory = decryptMedicalHistory(patient?.medicalHistory);
    const history = decodedHistory && typeof decodedHistory === 'object' && !Array.isArray(decodedHistory) ? decodedHistory as Record<string, unknown> : {};
    const raw = history.complaints ?? history.chiefComplaint ?? patient?.notes;
    const hasComplaints = Array.isArray(raw)
      ? raw.some((complaint) => Boolean(String(complaint).trim()))
      : Boolean(raw && String(raw).trim());

    // Persist routing metadata only. The action handlers re-read and decode the
    // clinic-scoped Patient row when work executes; complaint text never enters
    // the durable event payload or AI Employee task payload.
    const payload: PatientCreatedPayload = { patientId, hasComplaints };
    await aiEventBus.publish(EventType.PatientCreated, payload, {
      clinicId,
      userId: userId || 'system',
      source: 'crm.patient.created',
    });
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
    if (!['completed', 'delivered', 'ready', 'remake'].includes(status)) return;
    const needsRemake = status === 'remake';
    const notificationTitle = needsRemake ? 'Лабораторная работа требует переделки' : 'Лабораторный заказ готов';
    const doctorMessage = needsRemake
      ? 'Контроль качества не пройден. Требуется согласовать переделку с лабораторией.'
      : 'Лабораторный заказ готов к просмотру.';
    const operationsMessage = needsRemake
      ? 'Лабораторная работа не прошла контроль качества. Требуется следующий шаг клиники.'
      : 'Готовая лабораторная работа требует следующего шага.';
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
            title: notificationTitle,
            message: doctorMessage,
            link: `/lab?order=${encodeURIComponent(labOrderId)}`,
          },
          update: {
            title: notificationTitle,
            message: doctorMessage,
            link: `/lab?order=${encodeURIComponent(labOrderId)}`,
            read: false,
          },
        });
      }
    }

    // The clinical hand-off is not only a doctor's concern: reception/operations
    // may need to receive, schedule, collect payment, or hand the work to the patient.
    // Notify only OWNER/ADMIN members in the same clinic and keep the payload free
    // of laboratory files or medical result text.
    const opsMembers = await prisma.clinicMember.findMany({
      where: {
        clinicId,
        role: { in: ['OWNER', 'ADMIN'] },
        ...(targetDoctorId ? { userId: { not: targetDoctorId } } : {}),
      },
      select: { userId: true },
      take: 20,
    });
    await Promise.all(opsMembers.map(async ({ userId: opsUserId }) => {
      const notificationId = labOrderNotificationId(labOrderId, opsUserId);
      await prisma.notification.upsert({
        where: { id: notificationId },
        create: {
          id: notificationId,
          userId: opsUserId,
          type: 'workflow',
          title: notificationTitle,
          message: operationsMessage,
          link: `/lab?order=${encodeURIComponent(labOrderId)}`,
        },
        update: {
          title: notificationTitle,
          message: operationsMessage,
          link: `/lab?order=${encodeURIComponent(labOrderId)}`,
          read: false,
        },
      });
    }));

    if (!needsRemake) {
      await aiEventBus.publish(EventType.LabOrderCompleted, {
        labOrderId,
        patientId: patientId || order?.patientId || '',
        doctorId: targetDoctorId || '',
        status: order?.status || status,
        previousStatus,
      }, { clinicId, userId: userId || targetDoctorId || 'system', source: 'crm.labOrder.status_changed' });
    }
  });

  subscribe('diagnostics.result_ready', async ({ referralId, resultId, clinicId, centerId, doctorId, userId }) => {
    // Enforce the clinic boundary before delivering the proactive notification.
    // The durable event and notification retain identifiers only; patient names, study types and report data stay in the protected referral API.
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
            message: 'Результат диагностики готов к просмотру. Откройте направление для подробностей.',
            link: `/diagnostics/referrals/${referralId}`,
          },
          update: {
            title: 'Результат диагностики готов',
            message: 'Результат диагностики готов к просмотру. Откройте направление для подробностей.',
            link: `/diagnostics/referrals/${referralId}`,
            read: false,
          },
        });
      }
    }

    await aiEventBus.publish(EventType.DiagnosticResultReady, {
      referralId,
      resultId,
    }, { clinicId, userId: userId || doctorId || 'system', source: 'diagnostics.result_ready' });
  });

  subscribe('diagnostics.booking.created', async ({ centerId, bookingId, status, userId }) => {
    await aiEventBus.publish(EventType.DiagnosticBookingCreated, {
      bookingId, status,
    }, { clinicId: centerId, userId: userId || 'system', source: 'diagnostics.booking.created' });
  });

  subscribe('diagnostics.booking.status_changed', async ({ centerId, bookingId, status, previousStatus, userId }) => {
    await aiEventBus.publish(EventType.DiagnosticBookingStatusChanged, {
      bookingId, status, previousStatus,
    }, { clinicId: centerId, userId: userId || 'system', source: 'diagnostics.booking.status_changed' });
  });

  console.log('[events] AI Event OS bridge registered');
}