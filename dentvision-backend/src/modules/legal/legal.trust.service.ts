import { randomUUID } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { onboardPartner } from './legal.service.js';

/**
 * Resolve the legal partner for the active DentVision organization.
 *
 * Legal identity is organization-scoped. The user remains the signer/operator,
 * but the contract package belongs to the active organization so one person can
 * safely operate several clinics, labs, suppliers, academies, etc.
 *
 * Legacy accounts without an organization context are supported only when the
 * user has a single legal partner. If multiple partners exist, callers must
 * select an organization explicitly instead of silently choosing the wrong one.
 */
export async function getLegalPartnerForContext(userId: string, organizationId?: string | null) {
  if (organizationId) {
    const rows = await prisma.$queryRaw<Array<{ partner_id: string }>>`
      SELECT "partner_id"
      FROM "legal_partner_contexts"
      WHERE "organization_id" = ${organizationId}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return prisma.legalPartner.findUnique({
      where: { id: rows[0].partner_id },
      include: { documents: { select: { id: true, status: true, templateId: true, version: true } } },
    });
  }

  const partners = await prisma.legalPartner.findMany({
    where: { userId },
    include: { documents: { select: { id: true, status: true, templateId: true, version: true } } },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });
  return partners.length === 1 ? partners[0] : null;
}

/**
 * Partner onboarding must be retry-safe and organization-scoped. Domain
 * onboarding endpoints call this after they have created/recovered their
 * organization. A retry for the same organization reuses its legal package;
 * another organization owned by the same user gets a separate package.
 */
export async function ensureLegalTrustPackage(input: {
  userId: string;
  organizationId: string;
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
  const existing = await getLegalPartnerForContext(input.userId, input.organizationId);
  if (existing) {
    return { created: false, partner: existing, documents: existing.documents };
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

  try {
    await prisma.$executeRaw`
      INSERT INTO "legal_partner_contexts" ("id", "organization_id", "partner_id")
      VALUES (${randomUUID()}, ${input.organizationId}, ${result.partner.id})
    `;
  } catch (error: any) {
    // Concurrent retries can race on the organization unique key. Return the
    // winner's package instead of exposing a duplicate-package error.
    const code = error?.code || error?.meta?.code;
    if (code !== 'P2002' && !String(error?.message || '').includes('duplicate key')) throw error;
    const raced = await getLegalPartnerForContext(input.userId, input.organizationId);
    if (!raced) throw error;
    return { created: false, partner: raced, documents: raced.documents };
  }

  return { created: true, partner: result.partner, documents: result.documents };
}

/**
 * Server-side capability gate. A generated document is not treated as a
 * signature. Protected partner capabilities can require every mandatory
 * document to reach an explicitly accepted/signed state before activation.
 */
export async function hasExecutedLegalPrerequisites(
  userId: string,
  organizationId?: string | null,
  requiredTypes?: string[],
) {
  const partner = await getLegalPartnerForContext(userId, organizationId);
  if (!partner) {
    return {
      ok: false,
      reason: organizationId ? 'LEGAL_PARTNER_MISSING' as const : 'LEGAL_CONTEXT_REQUIRED' as const,
    };
  }

  const fullPartner = await prisma.legalPartner.findUnique({
    where: { id: partner.id },
    include: { documents: { include: { template: true } } },
  });
  if (!fullPartner) return { ok: false, reason: 'LEGAL_PARTNER_MISSING' as const };

  const docs = requiredTypes?.length
    ? fullPartner.documents.filter((doc) => requiredTypes.includes(String(doc.template.type)))
    : fullPartner.documents;

  if (docs.length === 0) return { ok: false, reason: 'LEGAL_DOCUMENTS_MISSING' as const };

  const unsigned = docs.filter((doc) => !['SIGNED', 'ACCEPTED', 'EXECUTED', 'ACTIVE'].includes(String(doc.status)));
  if (unsigned.length) {
    return {
      ok: false,
      reason: 'LEGAL_SIGNATURE_REQUIRED' as const,
      documentIds: unsigned.map((doc) => doc.id),
    };
  }

  return { ok: true as const, partnerId: fullPartner.id, documentIds: docs.map((doc) => doc.id) };
}
