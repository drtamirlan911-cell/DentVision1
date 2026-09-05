/**
 * The live-human channel a patient's assistant conversation escalates into.
 *
 * One conversation per (patient, clinic) at a time: a second escalation while
 * the first is still open appends to it rather than forking a parallel thread
 * staff would have to notice exists. `RESOLVED` closes it; the next
 * escalation after that opens a new one.
 */

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import type { PatientConversationAuthorType, PatientConversationStatus } from '@prisma/client';

export class ConversationError extends Error {
  constructor(message: string, readonly code: 'NOT_FOUND' | 'FORBIDDEN') {
    super(message);
  }
}

export interface ConversationSummary {
  id: string;
  clinicId: string;
  status: PatientConversationStatus;
  escalationReason: string | null;
  assignedToUserId: string | null;
  lastPatientMessageAt: Date | null;
  lastStaffMessageAt: Date | null;
  createdAt: Date;
}

const OPEN_STATUSES: PatientConversationStatus[] = ['WAITING', 'LIVE'];

/**
 * Finds the patient's open thread at this clinic, or opens one.
 *
 * Called from `askClinicStaff` at the moment the assistant hands off — this
 * is what turns "передал администратору" from a one-way notification into a
 * thread the patient can keep talking in and see a reply land on.
 */
export async function getOrOpenConversation(
  patientUserId: string,
  clinicId: string,
  escalationReason: string,
): Promise<ConversationSummary> {
  const existing = await prisma.patientConversation.findFirst({
    where: { patientUserId, clinicId, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.patientConversation.create({
    data: { id: uid(), patientUserId, clinicId, status: 'WAITING', escalationReason },
  });
}

/** The patient's current thread at this clinic, open or not — null if none exists yet. */
export async function getCurrentConversation(
  patientUserId: string,
  clinicId: string,
): Promise<ConversationSummary | null> {
  return prisma.patientConversation.findFirst({
    where: { patientUserId, clinicId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMessages(conversationId: string) {
  return prisma.patientConversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, authorType: true, authorUserId: true, body: true, createdAt: true },
  });
}

/**
 * Appends a message and updates the thread's own bookkeeping in the same
 * write: which side spoke last, and — for the first staff reply — claiming
 * the thread out of `WAITING` into `LIVE`. A message and its side effects on
 * the parent row are one fact, not two separate writes that could disagree.
 */
export async function appendMessage(
  conversationId: string,
  authorType: PatientConversationAuthorType,
  body: string,
  authorUserId?: string | null,
) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('EMPTY_MESSAGE');

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.patientConversationMessage.create({
      data: { id: uid(), conversationId, authorType, authorUserId: authorUserId || null, body: trimmed },
    }),
    prisma.patientConversation.update({
      where: { id: conversationId },
      data:
        authorType === 'STAFF'
          ? { lastStaffMessageAt: now, status: 'LIVE', assignedToUserId: authorUserId || undefined }
          : { lastPatientMessageAt: now },
    }),
  ]);
  return message;
}

/** Staff-side list, newest activity first — the shape an inbox renders directly. */
export async function listForClinic(clinicId: string, status?: PatientConversationStatus) {
  return prisma.patientConversation.findMany({
    where: { clinicId, ...(status ? { status } : {}) },
    orderBy: [{ lastPatientMessageAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Clinic-scoped fetch — the 404 either means it doesn't exist or belongs to
 * someone else, deliberately indistinguishable.
 *
 * Includes patientUser/assignedTo like listForClinic: getThreadForClinic
 * below hands this row straight back as `conversation` in the thread
 * response, and the Android client's InboxConversationSummary requires
 * patientUser (no default) — a bare findUnique() without it crashed the
 * decode every time a conversation thread was opened.
 */
async function requireClinicConversation(clinicId: string, conversationId: string) {
  const conversation = await prisma.patientConversation.findUnique({
    where: { id: conversationId },
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new ConversationError('Диалог не найден', 'NOT_FOUND');
  }
  return conversation;
}

export async function getThreadForClinic(clinicId: string, conversationId: string) {
  const conversation = await requireClinicConversation(clinicId, conversationId);
  const messages = await getMessages(conversationId);
  return { conversation, messages };
}

export async function replyAsStaff(
  clinicId: string,
  conversationId: string,
  staffUserId: string,
  body: string,
) {
  const conversation = await requireClinicConversation(clinicId, conversationId);
  if (conversation.status === 'RESOLVED') {
    throw new ConversationError('Диалог уже закрыт', 'FORBIDDEN');
  }
  return appendMessage(conversationId, 'STAFF', body, staffUserId);
}

export async function resolveConversation(clinicId: string, conversationId: string) {
  await requireClinicConversation(clinicId, conversationId);
  return prisma.patientConversation.update({
    where: { id: conversationId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
    // Same include as listForClinic — the Android client's row model
    // requires patientUser (no default), and a bare update() without it
    // used to come back missing the field entirely, crashing the decode
    // on every resolve tap.
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/** "Взять в работу" without necessarily replying yet — claims the thread so it drops off everyone else's unclaimed list. */
export async function claimConversation(clinicId: string, conversationId: string, staffUserId: string) {
  const conversation = await requireClinicConversation(clinicId, conversationId);
  if (conversation.status === 'RESOLVED') {
    throw new ConversationError('Диалог уже закрыт', 'FORBIDDEN');
  }
  return prisma.patientConversation.update({
    where: { id: conversationId },
    data: { status: 'LIVE', assignedToUserId: staffUserId },
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}
