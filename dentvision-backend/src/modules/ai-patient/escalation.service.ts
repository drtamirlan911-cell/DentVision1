/**
 * Handing a patient's question to a human at their clinic.
 *
 * This is the promise the assistant makes every time it says "я не знаю": that
 * saying so leads somewhere. An assistant that admits its limit and then drops
 * the question is worse than one that never offered — the patient has spent
 * their attempt and got nothing.
 *
 * The first layer is notification, not a live thread: OWNER and ADMIN of the
 * clinic holding the patient's card get the question in the bell they already
 * watch, and can call back. A real-time conversation with a staff inbox is the
 * next step; this one works today and does not leave the question nowhere.
 */

import prisma from '../../lib/prisma.js';

export interface EscalationInput {
  patientId: string;
  patientUserId: string;
  clinicId: string;
  /** What the patient actually asked, verbatim where possible. */
  question: string;
  /** Why the assistant could not answer — shown to staff, not to the patient. */
  reason: string;
  /** Set when triage ran, so an emergency is visibly an emergency in the bell. */
  urgency?: 'emergency' | 'urgent' | 'soon' | 'routine' | null;
}

export interface EscalationResult {
  delivered: boolean;
  /** How many staff members were notified — zero is a real, reportable state. */
  recipients: number;
  clinicName: string | null;
  clinicPhone: string | null;
}

/** Urgency drives the wording, so a staff member triaging their bell sees it. */
const URGENCY_PREFIX: Record<string, string> = {
  emergency: '🚨 СРОЧНО — ',
  urgent: 'Срочный вопрос — ',
  soon: '',
  routine: '',
};

export async function escalateToClinic(input: EscalationInput): Promise<EscalationResult> {
  const [clinic, patient] = await Promise.all([
    (prisma as any).clinic.findUnique({
      where: { id: input.clinicId },
      select: { name: true, phone: true },
    }),
    (prisma as any).patient.findUnique({
      where: { id: input.patientId },
      select: { firstName: true, lastName: true, phone: true },
    }),
  ]);

  const members = await (prisma as any).clinicMember.findMany({
    where: { clinicId: input.clinicId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });

  const patientName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Пациент';
  const prefix = URGENCY_PREFIX[input.urgency || 'routine'] ?? '';

  if (members.length > 0) {
    const { dispatchNotifications } = await import('../notifications/dispatch.service.js');
    await dispatchNotifications(
      members.map((m: any) => ({
        userId: m.userId,
        clinicId: input.clinicId,
        type: 'patient_question',
        title: `${prefix}Вопрос от пациента: ${patientName}`,
        // The staff member should be able to act from the notification alone:
        // who, what they asked, why it came here, and the number to call.
        message: [
          `«${input.question.slice(0, 400)}»`,
          patient?.phone ? `Телефон: ${patient.phone}` : null,
          `Ассистент передал вопрос: ${input.reason}`,
        ]
          .filter(Boolean)
          .join('\n'),
        link: '/crm/patients',
      })),
    );
  }

  return {
    delivered: members.length > 0,
    recipients: members.length,
    clinicName: clinic?.name || null,
    clinicPhone: clinic?.phone || null,
  };
}
