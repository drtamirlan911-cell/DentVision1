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
import { createNotificationForClinic, NOTIFICATION_TYPES } from '../services/notification.service.js';

export interface ReminderCronResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
  details: Array<{ appointmentId: string; reminderKey: string; channel?: string; error?: string }>;
}

/**
 * Returns `null` — not an empty array — when the table does not exist yet
 * (Prisma P2021, a fresh database before migrations). The caller turns that into
 * an empty result; an empty array would be indistinguishable from "nothing due".
 *
 * Kept as its own function so the query's payload type is inferred. Assigning it
 * to a bare `let` inside a try/catch widened it to `unknown[]`, which then made
 * `doctorIds` unusable as a Prisma `in` filter.
 */
async function findUpcomingAppointments(clinicId: string | undefined, from: Date, to: Date) {
  try {
    return await prisma.appointment.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        date: { gte: from, lte: to },
        status: { notIn: ['cancelled', 'no_show', 'completed'] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        clinic: { select: { id: true, name: true } },
      },
      take: 500,
    });
  } catch (err: any) {
    if (String(err?.code) === 'P2021') return null;
    throw err;
  }
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

  const appointments = await findUpcomingAppointments(opts.clinicId, from, to);
  if (!appointments) {
    return { scanned: 0, sent: 0, skipped: 0, errors: 0, details: [] };
  }

  const result: ReminderCronResult = { scanned: appointments.length, sent: 0, skipped: 0, errors: 0, details: [] };

  // Doctor names for messages
  const doctorIds = [...new Set(appointments.map((a) => a.doctorId))];
  const doctors = doctorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, firstName: true, lastName: true },
      }).catch((err: any) => (String(err?.code) === 'P2021' ? [] : Promise.reject(err)))
    : [];
  const doctorMap = new Map<string, string>(
    doctors.map((d: { id: string; firstName: string; lastName: string }) => [d.id, `${d.firstName} ${d.lastName}`.trim()]),
  );

  // Batch-fetch already-sent reminder logs once instead of per-appointment.
  const reminderKeys = appointments.map((a) => `appt_${a.id}`);
  const existingLogs = reminderKeys.length
    ? await prisma.reminderLog.findMany({
        where: { reminderKey: { in: reminderKeys } },
        select: { reminderKey: true },
      }).catch((err: any) => (String(err?.code) === 'P2021' ? [] : Promise.reject(err)))
    : [];
  const alreadySent = new Set(existingLogs.map((l) => l.reminderKey));

  for (const appt of appointments) {
    if (!isReminderEligibleDbStatus(appt.status) && !['pending', 'confirmed'].includes(appt.status)) {
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
    if (alreadySent.has(reminderKey)) {
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
    }).catch((err: any) => {
      if (String(err?.code) !== 'P2021') throw err;
    });

    // Also create an in-app notification for clinic staff
    await createNotificationForClinic(appt.clinicId, {
      type: NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
      title: `Напоминание о записи`,
      message: `${patientName} — ${dateStr} в ${appt.time || '09:00'}`,
      link: `/crm/schedule?date=${dateStr}`,
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
      await cleanupAbandonedOrders();
    } catch (err) {
      console.error('[ReminderCron] tick failed', err);
    }
  };
  // Delay first tick so DB is warm
  setTimeout(tick, 20_000);
  timer = setInterval(tick, ms);
  console.log(`[ReminderCron] interval started (${ms / 60000} min)`);
}

/**
 * Cancel orders stuck in pending / awaiting_payment longer than the TTL and
 * restore stock. Prevents inventory hoarding from abandoned checkouts
 * (audit F-1).
 */
export async function cleanupAbandonedOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  try {
    const stale = await prisma.order.findMany({
      where: {
        status: { in: ['pending', 'awaiting_payment'] },
        createdAt: { lt: cutoff },
      },
      select: { id: true, items: true, meta: true },
    });
    if (!stale.length) return;

    for (const o of stale) {
      await prisma.$transaction(async (tx) => {
        // Restore stock for each item
        for (const item of (o.items as any[]) || []) {
          if (item.product_id && item.quantity) {
            await tx.product.updateMany({
              where: { id: item.product_id },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
        // Expire any still-pending payment for this order so a late callback
        // cannot resurrect a cancelled checkout.
        const meta = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as { paymentId?: string };
        if (meta.paymentId) {
          await tx.payment.updateMany({
            where: { id: meta.paymentId, status: 'pending' },
            data: { status: 'expired' },
          });
        }
        await tx.order.update({ where: { id: o.id }, data: { status: 'cancelled' } });
      });
    }
    console.log(`[OrderCleanup] cancelled ${stale.length} abandoned orders`);
  } catch (err) {
    console.warn('[OrderCleanup] failed (non-fatal):', err);
  }
}
