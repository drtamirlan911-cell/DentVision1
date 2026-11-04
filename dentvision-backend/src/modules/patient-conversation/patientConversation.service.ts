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
import { decryptField, encryptField } from '../../lib/phi.js';
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
const ENCRYPTED_TEXT_PREFIX = 'ENC:';

/** New patient/clinic conversation text must never silently fall back to plaintext. */
function encryptConversationText(value: string): string {
  const encrypted = encryptField(value);
  if (!encrypted || !encrypted.startsWith(ENCRYPTED_TEXT_PREFIX)) {
    throw new Error('[phi] Patient conversation encryption did not produce ciphertext');
  }
  return encrypted;
}

/** Legacy unmarked rows remain readable until the separately approved backfill. */
function decryptConversationText(value: string | null | undefined): string {
  if (value == null) return '';
  return decryptField(value) ?? '';
}

function decodeConversation<T extends { escalationReason?: string | null }>(conversation: T): T {
  if (typeof conversation.escalationReason !== 'string') return conversation;
  return { ...conversation, escalationReason: decryptConversationText(conversation.escalationReason) } as T;
}

function decodeMessage<T extends { body: string }>(message: T): T {
  return { ...message, body: decryptConversationText(message.body) };
}

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
  if (existing) return decodeConversation(existing);

  const created = await prisma.patientConversation.create({
    data: {
      id: uid(),
      patientUserId,
      clinicId,
      status: 'WAITING',
      escalationReason: encryptConversationText(escalationReason),
    },
  });
  return decodeConversation(created);
}

/** The patient's current thread at this clinic, open or not — null if none exists yet. */
export async function getCurrentConversation(
  patientUserId: string,
  clinicId: string,
): Promise<ConversationSummary | null> {
  const conversation = await prisma.patientConversation.findFirst({
    where: { patientUserId, clinicId },
    orderBy: { createdAt: 'desc' },
  });
  return conversation ? decodeConversation(conversation) : null;
}

export async function getMessages(conversationId: string) {
  const messages = await prisma.patientConversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, authorType: true, authorUserId: true, body: true, createdAt: true },
  });
  return messages.map(decodeMessage);
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
      data: {
        id: uid(),
        conversationId,
        authorType,
        authorUserId: authorUserId || null,
        body: encryptConversationText(trimmed),
      },
    }),
    prisma.patientConversation.update({
      where: { id: conversationId },
      data:
        authorType === 'STAFF'
          ? { lastStaffMessageAt: now, status: 'LIVE', assignedToUserId: authorUserId || undefined }
          : { lastPatientMessageAt: now },
    }),
  ]);
  return decodeMessage(message);
}

/** Staff-side list, newest activity first — the shape an inbox renders directly. */
export async function listForClinic(clinicId: string, status?: PatientConversationStatus) {
  const conversations = await prisma.patientConversation.findMany({
    where: { clinicId, ...(status ? { status } : {}) },
    orderBy: [{ lastPatientMessageAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return conversations.map(decodeConversation);
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
  return decodeConversation(conversation);
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
  const conversation = await prisma.patientConversation.update({
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
  return decodeConversation(conversation);
}

/** "Взять в работу" without necessarily replying yet — claims the thread so it drops off everyone else's unclaimed list. */
export async function claimConversation(clinicId: string, conversationId: string, staffUserId: string) {
  const conversation = await requireClinicConversation(clinicId, conversationId);
  if (conversation.status === 'RESOLVED') {
    throw new ConversationError('Диалог уже закрыт', 'FORBIDDEN');
  }
  const updated = await prisma.patientConversation.update({
    where: { id: conversationId },
    data: { status: 'LIVE', assignedToUserId: staffUserId },
    include: {
      patientUser: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return decodeConversation(updated);
}
