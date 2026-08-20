/**
 * The read side of an AI escalation.
 *
 * When `markEscalated` fires it does two things: writes an `AiAdminEscalation`
 * row and calls `notifyClinicOwners`. So a human **is** told — the audit's first
 * draft said otherwise and was wrong, which is corrected in `SYSTEM_AUDIT.md`.
 *
 * What was missing is everything after that notification:
 *
 * - no way to list what is outstanding, so a notification missed is an
 *   escalation lost;
 * - `resolvedAt` and `resolvedBy` were never written by anything, so an
 *   escalation had no end state;
 * - no reminder, unlike the patient inbox, where `patientConversationOnCall`
 *   re-notifies a thread that has sat quiet for fifteen minutes.
 *
 * The schema already anticipated all of it: the columns exist and
 * `@@index([clinicId, resolvedAt])` is exactly the index a "what is still open
 * for this clinic" query needs. It was built for a queue nobody wrote.
 *
 * That matters more here than for most unfinished features. An escalation
 * happens precisely when the assistant could not cope, with a patient waiting
 * at the other end — the one moment where "the notification was missed" has to
 * be recoverable.
 */

import prisma from '../../../lib/prisma.js';

export class EscalationError extends Error {
  constructor(
    public code: 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'EscalationError';
  }
}

export interface EscalationFilters {
  /** Default: only what still needs a human. */
  includeResolved?: boolean;
  take?: number;
}

/**
 * What is still waiting on somebody, newest first.
 *
 * Scoped by clinic at the query, never filtered afterwards: an escalation
 * carries a patient's own words in `lastUserMessage`, so reading another
 * clinic's queue would be a PHI leak, not an inconvenience.
 */
export async function listEscalations(clinicId: string, filters: EscalationFilters = {}) {
  return prisma.aiAdminEscalation.findMany({
    where: {
      clinicId,
      ...(filters.includeResolved ? {} : { resolvedAt: null }),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.take ?? 50, 200),
  });
}

/** How many people are currently waiting — the number a badge would show. */
export async function countOpenEscalations(clinicId: string): Promise<number> {
  return prisma.aiAdminEscalation.count({ where: { clinicId, resolvedAt: null } });
}

/**
 * Close one out.
 *
 * `updateMany` scoped by both id and clinic rather than `update` by id: it
 * cannot touch another clinic's row even if an id is guessed, and a zero count
 * tells us so without a second read.
 *
 * Already-resolved rows are excluded from the match, so resolving twice reports
 * not-found instead of quietly rewriting who resolved it and when.
 */
export async function resolveEscalation(
  clinicId: string,
  escalationId: string,
  resolvedBy: string,
) {
  const { count } = await prisma.aiAdminEscalation.updateMany({
    where: { id: escalationId, clinicId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedBy },
  });
  if (count === 0) {
    throw new EscalationError('NOT_FOUND', 'Эскалация не найдена или уже закрыта');
  }
  return prisma.aiAdminEscalation.findUnique({ where: { id: escalationId } });
}

/** Re-notify an escalation nobody has picked up in this long. */
export const DEFAULT_ESCALATION_REMINDER_MS = 15 * 60 * 1000;

export interface EscalationReminderResult {
  checked: number;
  renotified: number;
}

/**
 * Chase escalations that have gone unanswered.
 *
 * Deliberately the same shape and threshold as `patientConversationOnCall`:
 * the two are the same promise to the same person — someone is waiting and a
 * human has to arrive — and having them behave differently would be a
 * difference nobody could justify to a patient.
 *
 * Reuses `notifyClinicOwners`, the same channel the first notification used, so
 * a reminder cannot arrive somewhere the original did not.
 */
export async function runEscalationReminders(
  thresholdMs = DEFAULT_ESCALATION_REMINDER_MS,
): Promise<EscalationReminderResult> {
  const cutoff = new Date(Date.now() - thresholdMs);
  const stale = await prisma.aiAdminEscalation.findMany({
    where: { resolvedAt: null, createdAt: { lte: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  if (stale.length === 0) return { checked: 0, renotified: 0 };

  const { notifyClinicOwners } = await import('../../billing/clinicSubscription.service.js');
  const minutes = Math.round(thresholdMs / 60_000);
  let renotified = 0;

  for (const escalation of stale) {
    try {
      await notifyClinicOwners(
        escalation.clinicId,
        'Эскалация всё ещё без ответа',
        `Пациент ждёт больше ${minutes} мин. Причина: ${escalation.reason}`,
      );
      renotified += 1;
    } catch (error) {
      // One clinic's notification channel failing must not stop the rest of
      // the queue from being chased.
      console.warn('[EscalationReminder] notify failed:', error);
    }
  }

  return { checked: stale.length, renotified };
}
