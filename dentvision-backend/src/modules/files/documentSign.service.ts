/**
 * Patient document signing — remote (public link, e.g. informed-consent forms
 * sent via WhatsApp/SMS) and in-clinic (staff-witnessed, while authenticated).
 * Both paths share this logic so behavior — persisted signature payload,
 * idempotent re-sign, token/staff authorization — never drifts between them.
 */
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';

export interface SignablePublicDocument {
  id: string;
  title: string;
  doc_type: string;
  /** Decoded plain-text content — only for composer-authored (data:text/plain) documents. */
  content: string | null;
  status: 'pending' | 'signed';
  patient_name: string | null;
  signed_by_name: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  clinic_phone: string | null;
  documentId: string;
}

/** Generate (or reuse) a one-time public sign token for a document. */
export async function createSignLink(documentId: string): Promise<{ token: string; signUrl: string }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { signToken: true } });
  if (!doc) {
    const err = new Error('Документ не найден');
    (err as any).status = 404;
    throw err;
  }
  const token = doc.signToken || uid().replace(/-/g, '');
  if (!doc.signToken) {
    await prisma.document.update({ where: { id: documentId }, data: { signToken: token } });
  }
  return { token, signUrl: `/sign/${documentId}?token=${token}` };
}

function decodeTextContent(url: string): string | null {
  const prefix = 'data:text/plain;charset=utf-8;base64,';
  if (!url.startsWith(prefix)) return null;
  try {
    return Buffer.from(url.slice(prefix.length), 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/** Public, token-gated lookup for the patient signing page. Never exposes storage URLs for uploaded files. */
export async function getDocumentForSigning(token: string): Promise<SignablePublicDocument | null> {
  if (!token) return null;
  const doc = await prisma.document.findUnique({
    where: { signToken: token },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      clinic: { select: { name: true, address: true, phone: true } },
    },
  });
  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.name || 'Документ',
    doc_type: doc.type,
    content: decodeTextContent(doc.url),
    status: doc.signed ? 'signed' : 'pending',
    patient_name: doc.patient ? `${doc.patient.firstName} ${doc.patient.lastName}`.trim() : null,
    signed_by_name: doc.signedByName,
    clinic_name: doc.clinic?.name ?? null,
    clinic_address: doc.clinic?.address ?? null,
    clinic_phone: doc.clinic?.phone ?? null,
    documentId: doc.id,
  };
}

export interface SignDocumentInput {
  documentId: string;
  signatureData?: string;
  signedByName?: string;
  /** Public link token — required unless the caller is an authenticated clinic staff member. */
  token?: string;
  /** Clinic of the authenticated requester, for the staff-witnessed path. */
  requesterClinicId?: string | null;
}

/**
 * Authorize (matching sign token OR same-clinic staff) and persist a
 * signature. Idempotent: signing an already-signed document returns the
 * existing record unchanged rather than overwriting a legally significant
 * signature.
 */
export async function signDocument(input: SignDocumentInput) {
  const doc = await prisma.document.findUnique({ where: { id: input.documentId } });
  if (!doc) {
    const err = new Error('Документ не найден');
    (err as any).status = 404;
    throw err;
  }

  const staffOk = !!input.requesterClinicId && (!doc.clinicId || doc.clinicId === input.requesterClinicId);
  const tokenOk = !!input.token && !!doc.signToken && input.token === doc.signToken;
  if (!staffOk && !tokenOk) {
    const err = new Error('Нет права подписи');
    (err as any).status = 403;
    throw err;
  }

  if (doc.signed) return doc;

  return prisma.document.update({
    where: { id: doc.id },
    data: {
      signed: true,
      signedAt: new Date(),
      signatureData: input.signatureData || null,
      signedByName: input.signedByName || null,
    },
  });
}
