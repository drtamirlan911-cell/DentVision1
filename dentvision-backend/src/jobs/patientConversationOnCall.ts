/**
 * The on-call timer: a thread nobody has claimed re-notifies, instead of
 * sitting quietly in a bell nobody re-opened.
 *
 * One notification at escalation time is not a guarantee anyone saw it — a
 * clinic's OWNER could be mid-appointment, asleep, or simply behind on
 * notifications. A patient in pain who hears nothing back for an hour has no
 * way to tell "the message never arrived" from "everyone is ignoring me";
 * this makes the first case impossible and shortens the second.
 */

import prisma from '../lib/prisma.js';

export interface OnCallCheckResult {
  scanned: number;
  renotified: number;
}

/** Re-notify a `WAITING` thread if it has sat this long since it (or its last renotify) went quiet. */
const DEFAULT_THRESHOLD_MS = 15 * 60 * 1000;

export async function runOnCallCheck(thresholdMs = DEFAULT_THRESHOLD_MS): Promise<OnCallCheckResult> {
  const cutoff = new Date(Date.now() - thresholdMs);

  const stale = await prisma.patientConversation.findMany({
    where: {
      status: 'WAITING',
      lastPatientMessageAt: { lte: cutoff },
      OR: [{ onCallNotifiedAt: null }, { onCallNotifiedAt: { lte: cutoff } }],
    },
    include: {
      clinic: { select: { id: true, name: true } },
      patientUser: { select: { firstName: true, lastName: true } },
    },
    take: 200,
  }).catch((err: any) => {
    if (String(err?.code) === 'P2021') return [];
    throw err;
  });

  const result: OnCallCheckResult = { scanned: stale.length, renotified: 0 };
  if (!stale.length) return result;

  const { dispatchNotifications } = await import('../modules/notifications/dispatch.service.js');

  for (const conversation of stale) {
    const members = await prisma.clinicMember.findMany({
      where: { clinicId: conversation.clinicId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    });
    if (!members.length) continue;

    const minutes = Math.round(thresholdMs / 60_000);
    const patientName = [conversation.patientUser.firstName, conversation.patientUser.lastName]
      .filter(Boolean)
      .join(' ') || 'Пациент';

    await dispatchNotifications(
      members.map((m) => ({
        userId: m.userId,
        clinicId: conversation.clinicId,
        type: 'patient_question',
        title: `⏰ Без ответа ${minutes}+ мин — ${patientName}`,
        message: 'Пациент ждёт ответа в диалоге. Откройте инбокс, чтобы ответить.',
        link: `/crm/patient-inbox/${conversation.id}`,
      })),
    );

    await prisma.patientConversation.update({
      where: { id: conversation.id },
      data: { onCallNotifiedAt: new Date() },
    });
    result.renotified += 1;
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Safe no-op if already started — same shape as `startReminderCronInterval`. */
export function startOnCallInterval(ms = 5 * 60 * 1000, thresholdMs = DEFAULT_THRESHOLD_MS): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await runOnCallCheck(thresholdMs);
      if (r.renotified) {
        console.log(`[OnCallTimer] scanned=${r.scanned} renotified=${r.renotified}`);
      }
    } catch (err) {
      console.error('[OnCallTimer] tick failed', err);
    }

    // AI escalations ride the same timer rather than starting a second one:
    // they are the same promise to the same person — somebody is waiting and a
    // human has to arrive — and two timers with two thresholds would drift into
    // a difference nobody could justify to a patient.
    //
    // Its own try/catch: a failure chasing escalations must not stop the
    // conversation sweep above, or vice versa.
    try {
      const { runEscalationReminders } = await import('../modules/ai-admin/conversation/escalation.service.js');
      const e = await runEscalationReminders(thresholdMs);
      if (e.renotified) {
        // `warn`, not `log`: a re-notification means somebody has been waiting
        // over the threshold with no human response. That is not routine.
        console.warn(`[OnCallTimer] escalations checked=${e.checked} renotified=${e.renotified}`);
      }
    } catch (err) {
      console.error('[OnCallTimer] escalation sweep failed', err);
    }
  };
  setTimeout(tick, 30_000);
  timer = setInterval(tick, ms);
  console.log(`[OnCallTimer] interval started (check every ${ms / 60000} min, threshold ${thresholdMs / 60000} min)`);
}
