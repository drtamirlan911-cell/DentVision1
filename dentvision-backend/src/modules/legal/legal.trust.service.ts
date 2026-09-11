import prisma from '../../lib/prisma.js';
import { onboardPartner } from './legal.service.js';

/**
 * Partner onboarding must be retry-safe. Domain onboarding endpoints can call
 * this helper after they have created/recovered their organization. It never
 * creates a second LegalPartner for the same DentVision account.
 *
 * This is deliberately separate from `onboardPartner`: that lower-level
 * function remains the document-generation primitive used by the legal admin
 * workflows. This helper is the self-service boundary.
 */
export async function ensureLegalTrustPackage(input: {
  userId: string;
  type: string;
  legalName: string;
  bin?: string | null;
  director?: string | null;
  address?: string | null;
  iban?: string | null;
  phone?: string | null;
  email?: string | null;
  commission?: number | null;
}) {
  const existing = await prisma.legalPartner.findUnique({
    where: { userId: input.userId },
    include: { documents: { select: { id: true, status: true, templateId: true, version: true } } },
  });

  if (existing) {
    return {
      created: false,
      partner: existing,
      documents: existing.documents,
    };
  }

  const result = await onboardPartner({
    userId: input.userId,
    type: input.type,
    legalName: input.legalName,
    bin: input.bin || '',
    director: input.director || '',
    address: input.address || '',
    iban: input.iban || '',
    phone: input.phone || '',
    email: input.email || '',
    commission: input.commission ?? 10,
  }, input.userId);

  return {
    created: true,
    partner: result.partner,
    documents: result.documents,
  };
}

/**
 * Server-side capability gate. A generated document is not treated as a
 * signature. Protected partner capabilities can require every mandatory
 * document to reach an explicitly accepted/signed state before activation.
 */
export async function hasExecutedLegalPrerequisites(userId: string, requiredTypes?: string[]) {
  const partner = await prisma.legalPartner.findUnique({
    where: { userId },
    include: {
      documents: {
        include: { template: true },
      },
    },
  });
  if (!partner) return { ok: false, reason: 'LEGAL_PARTNER_MISSING' as const };

  const docs = requiredTypes?.length
    ? partner.documents.filter((doc) => requiredTypes.includes(String(doc.template.type)))
    : partner.documents;

  if (docs.length === 0) return { ok: false, reason: 'LEGAL_DOCUMENTS_MISSING' as const };

  const unsigned = docs.filter((doc) => !['SIGNED', 'ACCEPTED', 'EXECUTED', 'ACTIVE'].includes(String(doc.status)));
  if (unsigned.length) {
    return {
      ok: false,
      reason: 'LEGAL_SIGNATURE_REQUIRED' as const,
      documentIds: unsigned.map((doc) => doc.id),
    };
  }

  return { ok: true as const, partnerId: partner.id, documentIds: docs.map((doc) => doc.id) };
}
