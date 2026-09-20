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
 * Person or ClinicMember link behind it exists. Unified organization contexts
 * additionally require an active canonical PersonRole; a revoked role must not
 * be resurrected through login/context fallback while a legacy ClinicMember row
 * still exists.
 *
 * Note on ids: `Organization.id` is NOT the id of the entity it mirrors — the
 * backfill and every creation site mint a fresh id and record the source in
 * `originalId`. A clinic's legacy id is therefore `organization.originalId`,
 * never `organization.id`.
 */

import prisma from './prisma.js';
import { resolveActivePersonRole } from '../middleware/auth.js';

export interface AuthTokenContext {
  clinicId?: string;
  organizationId?: string;
  organizationType?: string;
  personType?: string;
  branchId?: string;
}

type PersonWithContextRole = {
  userId: string;
  organizationId: string | null;
  personType: string;
  organization: { id: string; type: string; originalId: string | null } | null;
  personRoles: Array<{ scopeType: string | null; scopeId: string | null; role: { key: string } }>;
};

function contextFromPerson(person: PersonWithContextRole, organizationId: string): AuthTokenContext | null {
  if (!person.organization) return null;
  if (!resolveActivePersonRole(person.personRoles, organizationId)) return null;

  const org = person.organization;
  return {
    organizationId: org.id,
    organizationType: org.type,
    personType: person.personType || undefined,
    clinicId: org.type === 'CLINIC' ? org.originalId || undefined : undefined,
  };
}

async function contextForOrganization(userId: string, organizationId: string): Promise<AuthTokenContext | null> {
  const person = await prisma.person.findFirst({
    where: { userId, organizationId },
    include: {
      organization: { select: { id: true, type: true, originalId: true } },
      personRoles: { select: { scopeType: true, scopeId: true, role: { select: { key: true } } } },
    },
  });
  if (!person) return null;
  return contextFromPerson(person, organizationId);
}

async function contextForClinic(userId: string, clinicId: string): Promise<AuthTokenContext | null> {
  const org = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true },
  });
  if (org) {
    const viaOrg = await contextForOrganization(userId, org.id);
    if (viaOrg) return viaOrg;

    // A unified Person exists but no active scoped role. Do not fall through to
    // the legacy ClinicMember row, or a revoked IAM role could be resurrected.
    const unifiedPerson = await prisma.person.findFirst({ where: { userId, organizationId: org.id }, select: { id: true } });
    if (unifiedPerson) return null;
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
 * rather than being trusted. A known unified organization with a revoked role
 * is a hard denial for that requested organization, not a reason to resurrect
 * the same scope through a legacy membership row.
 */
export async function resolveAuthContext(
  userId: string,
  preferred?: { organizationId?: string | null; clinicId?: string | null; branchId?: string | null },
): Promise<AuthTokenContext> {
  if (preferred?.organizationId) {
    const ctx = await contextForOrganization(userId, preferred.organizationId);
    if (ctx) return ctx;

    // Do not reinterpret a known unified organization as a legacy/default
    // context after its PersonRole has been revoked.
    const unifiedPerson = await prisma.person.findFirst({ where: { userId, organizationId: preferred.organizationId }, select: { id: true } });
    if (unifiedPerson) return {};
  }

  if (preferred?.clinicId) {
    const ctx = await contextForClinic(userId, preferred.clinicId);
    if (ctx) return ctx;

    // If the clinic is represented by a unified Person without an active role,
    // do not continue into an unrelated default organization.
    const clinicOrg = await prisma.organization.findFirst({ where: { originalType: 'Clinic', originalId: preferred.clinicId }, select: { id: true } });
    if (clinicOrg) {
      const unifiedPerson = await prisma.person.findFirst({ where: { userId, organizationId: clinicOrg.id }, select: { id: true } });
      if (unifiedPerson) return {};
    }
  }

  if (preferred?.branchId) {
    const rows = await prisma.$queryRaw<Array<{ id: string; organization_id: string | null }>>`SELECT "id", "organization_id" FROM "branches" WHERE "id" = ${preferred.branchId} LIMIT 1`;
    const branch = rows[0];
    if (!branch?.organization_id) return {};
    const ctx = await contextForOrganization(userId, preferred.organizationId || branch.organization_id);
    if (!ctx || ctx.organizationId !== branch.organization_id) return {};
    const person = await prisma.person.findFirst({ where: { userId, organizationId: branch.organization_id }, select: { id: true, personRoles: { select: { role: { select: { key: true } } } }, branchMemberships: { where: { branchId: preferred.branchId }, select: { branchId: true } } } });
    const roleKeys = (person?.personRoles || []).map((r) => r.role.key.toLowerCase());
    const orgManager = roleKeys.some((key) => ['owner', 'org_owner', 'admin', 'org_admin'].includes(key));
    const assigned = (person?.branchMemberships?.length || 0) > 0;
    if (!orgManager && !assigned) return {};
    return { ...ctx, branchId: preferred.branchId };
  }
  // Default scope — a clinic the user belongs to takes precedence over other
  // organization types, matching the legacy "first membership" behaviour.
  const clinicPeople = await prisma.person.findMany({
    where: { userId, organization: { type: 'CLINIC' } },
    include: {
      organization: { select: { id: true, type: true, originalId: true } },
      personRoles: { select: { scopeType: true, scopeId: true, role: { select: { key: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const clinicPerson of clinicPeople) {
    const ctx = contextFromPerson(clinicPerson, clinicPerson.organizationId || clinicPerson.organization?.id || '');
    if (ctx) return ctx;
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

  const people = await prisma.person.findMany({
    where: { userId },
    include: {
      organization: { select: { id: true, type: true, originalId: true } },
      personRoles: { select: { scopeType: true, scopeId: true, role: { select: { key: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const person of people) {
    const orgId = person.organizationId || person.organization?.id;
    if (!orgId) continue;
    const ctx = contextFromPerson(person, orgId);
    if (ctx) return ctx;
  }

  return {};
}
