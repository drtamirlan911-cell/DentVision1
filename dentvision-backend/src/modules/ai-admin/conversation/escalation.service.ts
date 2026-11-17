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
import { decryptAiAdminText } from './phi.js';

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

function decodeEscalation<T extends { reason: string; lastUserMessage: string }>(row: T): T {
  return {
    ...row,
    reason: decryptAiAdminText(row.reason),
    lastUserMessage: decryptAiAdminText(row.lastUserMessage),
  };
}

export async function listEscalations(clinicId: string, filters: EscalationFilters = {}) {
  const rows = await prisma.aiAdminEscalation.findMany({
    where: {
      clinicId,
      ...(filters.includeResolved ? {} : { resolvedAt: null }),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.take ?? 50, 200),
  });
  return rows.map(decodeEscalation);
}

export async function countOpenEscalations(clinicId: string): Promise<number> {
  return prisma.aiAdminEscalation.count({ where: { clinicId, resolvedAt: null } });
}

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
  const row = await prisma.aiAdminEscalation.findUnique({ where: { id: escalationId } });
  return row ? decodeEscalation(row) : null;
}

export const DEFAULT_ESCALATION_REMINDER_MS = 15 * 60 * 1000;

export interface EscalationReminderResult {
  checked: number;
  renotified: number;
}

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
        `Пациент ждёт больше ${minutes} мин. Откройте очередь эскалаций для подробностей.`,
      );
      renotified += 1;
    } catch {
      // Provider error details can contain patient content.
      console.warn('[EscalationReminder] notify failed');
    }
  }

  return { checked: stale.length, renotified };
}
