/**
 * Unified context for issued tokens.
 *
 * Every JWT should carry where the user actually is — the Organization, its
 * type, the Person type, and the legacy clinicId that the rest of the codebase
 * still queries by. Until now only `POST /iam/switch-context` populated those
 * fields: login, registration and refresh emitted a legacy `clinicId` only, and
 * refresh dropped whatever context a switch had established, silently
 * downgrading the session back to legacy on the next token rotation.
 *
 * Membership is verified here, so a context is only ever embedded once the
 * Person or ClinicMember link behind it exists.
 *
 * Note on ids: `Organization.id` is NOT the id of the entity it mirrors — the
 * backfill and every creation site mint a fresh id and record the source in
 * `originalId`. A clinic's legacy id is therefore `organization.originalId`,
 * never `organization.id`.
 */

import prisma from './prisma.js';

export interface AuthTokenContext {
  clinicId?: string;
  organizationId?: string;
  organizationType?: string;
  personType?: string;
}

async function contextForOrganization(userId: string, organizationId: string): Promise<AuthTokenContext | null> {
  const person = await prisma.person.findFirst({
    where: { userId, organizationId },
    include: { organization: { select: { id: true, type: true, originalId: true } } },
  });
  if (!person?.organization) return null;

  const org = person.organization;
  return {
    organizationId: org.id,
    organizationType: org.type,
    personType: person.personType || undefined,
    clinicId: org.type === 'CLINIC' ? org.originalId || undefined : undefined,
  };
}

async function contextForClinic(userId: string, clinicId: string): Promise<AuthTokenContext | null> {
  const org = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true },
  });
  if (org) {
    const viaOrg = await contextForOrganization(userId, org.id);
    if (viaOrg) return viaOrg;
  }

  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { id: true },
  });
  return member ? { clinicId } : null;
}

/**
 * Resolve the context to embed in a freshly issued token.
 *
 * `preferred` carries what the caller is asking for — the scope from the token
 * being refreshed, or the clinic just joined. It is treated as a request, not a
 * fact: an unverifiable preference falls through to the user's default scope
 * rather than being trusted.
 */
export async function resolveAuthContext(
  userId: string,
  preferred?: { organizationId?: string | null; clinicId?: string | null },
): Promise<AuthTokenContext> {
  if (preferred?.organizationId) {
    const ctx = await contextForOrganization(userId, preferred.organizationId);
    if (ctx) return ctx;
  }

  if (preferred?.clinicId) {
    const ctx = await contextForClinic(userId, preferred.clinicId);
    if (ctx) return ctx;
  }

  // Default scope — a clinic the user belongs to takes precedence over other
  // organization types, matching the legacy "first membership" behaviour.
  const clinicPerson = await prisma.person.findFirst({
    where: { userId, organization: { type: 'CLINIC' } },
    include: { organization: { select: { id: true, type: true, originalId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (clinicPerson?.organization) {
    return {
      organizationId: clinicPerson.organization.id,
      organizationType: 'CLINIC',
      personType: clinicPerson.personType || undefined,
      clinicId: clinicPerson.organization.originalId || undefined,
    };
  }

  const member = await prisma.clinicMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    select: { clinicId: true },
  });
  if (member) {
    const ctx = await contextForClinic(userId, member.clinicId);
    if (ctx) return ctx;
  }

  const anyPerson = await prisma.person.findFirst({
    where: { userId },
    include: { organization: { select: { id: true, type: true, originalId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (anyPerson?.organization) {
    return {
      organizationId: anyPerson.organization.id,
      organizationType: anyPerson.organization.type,
      personType: anyPerson.personType || undefined,
    };
  }

  return {};
}
