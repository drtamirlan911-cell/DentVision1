/**
 * Reminder cron — scan upcoming appointments and send WhatsApp/SMS.
 * Spec §05: server cron (deep-link UI remains as manual fallback).
 */

import prisma from '../lib/prisma.js';
import { uid } from '../lib/helpers.js';
import { sendReminderMessage } from '../services/messaging.js';
import {
  appointmentInWindow,
  buildAppointmentReminderMessage,
  isReminderEligibleDbStatus,
} from '../modules/crm/reminderEligibility.js';
import { fromDbStatus } from '../modules/crm/appointmentMeta.js';

export interface ReminderCronResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
  details: Array<{ appointmentId: string; reminderKey: string; channel?: string; error?: string }>;
}

export async function runReminderCron(opts: {
  clinicId?: string;
  hoursWindow?: number;
  hoursMin?: number;
} = {}): Promise<ReminderCronResult> {
  const hoursWindow = opts.hoursWindow ?? 24;
  const hoursMin = opts.hoursMin ?? 0;
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now.getTime() + (hoursWindow + 1) * 3600 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(opts.clinicId ? { clinicId: opts.clinicId } : {}),
      date: { gte: from, lte: to },
      status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      clinic: { select: { id: true, name: true } },
    },
    take: 500,
  });

  const result: ReminderCronResult = { scanned: appointments.length, sent: 0, skipped: 0, errors: 0, details: [] };

  // Doctor names for messages
  const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
  const doctors = doctorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const doctorMap = new Map(doctors.map((d) => [d.id, `${d.firstName} ${d.lastName}`.trim()]));

  for (const appt of appointments) {
    if (!isReminderEligibleDbStatus(appt.status) && !['PENDING', 'CONFIRMED'].includes(appt.status)) {
      result.skipped += 1;
      continue;
    }
    // Also skip floor statuses stored only in meta
    const flow = (appt.meta as any)?.flowStatus;
    if (flow === 'arrived' || flow === 'in_chair') {
      result.skipped += 1;
      continue;
    }
    if (!appointmentInWindow(appt.date, appt.time, hoursWindow, hoursMin, now)) {
      result.skipped += 1;
      continue;
    }

    const reminderKey = `appt_${appt.id}`;
    const already = await prisma.reminderLog.findFirst({
      where: { clinicId: appt.clinicId, reminderKey },
      select: { id: true },
    });
    if (already) {
      result.skipped += 1;
      continue;
    }

    const phone = appt.patient?.phone;
    if (!phone) {
      result.skipped += 1;
      result.details.push({ appointmentId: appt.id, reminderKey, error: 'no_phone' });
      continue;
    }

    const patientName = appt.patient
      ? `${appt.patient.firstName} ${appt.patient.lastName}`.trim()
      : 'Пациент';
    const dateStr = appt.date.toISOString().slice(0, 10);
    const message = buildAppointmentReminderMessage({
      patientName,
      date: dateStr,
      time: appt.time || '09:00',
      doctorName: doctorMap.get(appt.doctorId),
      type: appt.type,
      clinicName: appt.clinic?.name,
    });

    const send = await sendReminderMessage(phone, message);
    if (!send.ok) {
      result.errors += 1;
      result.details.push({ appointmentId: appt.id, reminderKey, error: send.error });
      continue;
    }

    await prisma.reminderLog.create({
      data: {
        id: uid(),
        clinicId: appt.clinicId,
        reminderKey,
        channel: send.channel,
        meta: {
          appointmentId: appt.id,
          dryRun: !!send.dryRun,
          sid: send.sid,
          status: fromDbStatus(appt.status),
        } as any,
      },
    });

    result.sent += 1;
    result.details.push({ appointmentId: appt.id, reminderKey, channel: send.channel });
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start in-process interval (default 15 min). Safe no-op if already started. */
export function startReminderCronInterval(ms = 15 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await runReminderCron({ hoursWindow: 24, hoursMin: 0 });
      if (r.sent || r.errors) {
        console.log(`[ReminderCron] scanned=${r.scanned} sent=${r.sent} skipped=${r.skipped} errors=${r.errors}`);
      }
    } catch (err) {
      console.error('[ReminderCron] tick failed', err);
    }
  };
  // Delay first tick so DB is warm
  setTimeout(tick, 20_000);
  timer = setInterval(tick, ms);
  console.log(`[ReminderCron] interval started (${ms / 60000} min)`);
}
