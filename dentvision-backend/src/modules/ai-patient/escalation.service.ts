/**
 * Handing a patient's question to a human at their clinic.
 *
 * This is the promise the assistant makes every time it says "я не знаю": that
 * saying so leads somewhere. An assistant that admits its limit and then drops
 * the question is worse than one that never offered — the patient has spent its
 * attempt and got nothing.
 *
 * OWNER and ADMIN of the clinic holding the patient's card receive a generic
 * notification linking to the scoped inbox. The question and handoff reason
 * stay in the protected conversation thread, not in notification storage.
 */

import prisma from '../../lib/prisma.js';
import * as convo from '../patient-conversation/patientConversation.service.js';
import { clinicInboxHub } from '../patient-conversation/conversationHub.js';

export interface EscalationInput {
  patientId: string;
  patientUserId: string;
  clinicId: string;
  question: string;
  reason: string;
  urgency?: 'emergency' | 'urgent' | 'soon' | 'routine' | null;
}

export interface EscalationResult {
  delivered: boolean;
  recipients: number;
  clinicName: string | null;
  clinicPhone: string | null;
  conversationId: string;
}

export async function escalateToClinic(input: EscalationInput): Promise<EscalationResult> {
  const [clinic, patient] = await Promise.all([
    (prisma as any).clinic.findUnique({
      where: { id: input.clinicId },
      select: { name: true, phone: true },
    }),
    // Tenant boundary: do not create a conversation or disclose patient data
    // when the patient does not belong to the target clinic.
    (prisma as any).patient.findFirst({
      where: { id: input.patientId, clinicId: input.clinicId },
      select: { id: true },
    }),
  ]);

  if (!clinic) {
    throw new Error('Clinic not found');
  }
  if (!patient) {
    throw new Error('Patient does not belong to clinic');
  }

  const members = await (prisma as any).clinicMember.findMany({
    where: { clinicId: input.clinicId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });

  const conversation = await convo.getOrOpenConversation(input.patientUserId, input.clinicId, input.reason);
  await convo.appendMessage(conversation.id, 'PATIENT', input.question);
  clinicInboxHub.broadcast(input.clinicId, { type: 'escalation', conversationId: conversation.id, urgency: input.urgency || null });

  if (members.length > 0) {
    const { dispatchNotifications } = await import('../notifications/dispatch.service.js');
    await dispatchNotifications(
      members.map((m: any) => ({
        userId: m.userId,
        clinicId: input.clinicId,
        type: 'patient_question',
        title: 'Вопрос пациента требует ответа',
        message: 'Пациент передал обращение через ассистента. Откройте инбокс, чтобы прочитать и ответить.',
        link: `/crm/patient-inbox/${conversation.id}`,
      })),
    );
  }

  return {
    delivered: members.length > 0,
    recipients: members.length,
    clinicName: clinic.name || null,
    clinicPhone: clinic.phone || null,
    conversationId: conversation.id,
  };
}
