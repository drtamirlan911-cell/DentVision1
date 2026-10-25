import prisma from './prisma.js';
import type { AuthUser } from '../types/index.js';

/**
 * Resolve the effective organization context for a user.
 * Returns organizationId (clinicId fallback), organization, and person.
 */
export async function resolveOrgContext(user: AuthUser) {
  const orgId = user.organizationId || user.clinicId;
  if (!orgId) return { orgId: null, organization: null, person: null };

  const organization = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!organization && user.clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: user.clinicId } });
    if (clinic) return { orgId: user.clinicId, organization: { id: clinic.id, name: clinic.name, type: 'CLINIC' }, person: null };
  }
  const person = await prisma.person.findFirst({ where: { userId: user.id, organizationId: orgId } });
  return { orgId, organization, person };
}

export function getClinicId(user: AuthUser): string | undefined { return user.clinicId; }

export async function assertOrgAccess(user: AuthUser, orgId: string): Promise<boolean> {
  if (user.role === 'SUPERADMIN') return true;
  const person = await prisma.person.findFirst({
    where: {
      userId: user.id,
      organizationId: orgId,
      personRoles: { some: { scopeType: 'organization', scopeId: orgId } },
    },
    select: { id: true },
  });
  if (person) return true;
  // Once an organization exists, legacy ClinicMember must not bypass the
  // canonical organization-scoped PersonRole boundary.
  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (organization) return false;
  const member = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId: user.id, clinicId: orgId } } });
  return Boolean(member);
}

export async function isClinicMember(userId: string, clinicId: string): Promise<boolean> {
  if (!userId || !clinicId) return false;

  // Canonical authorization source: Organization + Person + organization-scoped
  // PersonRole. The legacy ClinicMember table remains a domain compatibility
  // source, but it must not authorize access once the clinic has been
  // canonicalized to an Organization.
  const organization = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true },
  });
  if (organization) {
    return Boolean(await prisma.person.findFirst({
      where: {
        userId,
        organizationId: organization.id,
        personRoles: { some: { scopeType: 'organization', scopeId: organization.id } },
      },
      select: { id: true },
    }));
  }

  // Pre-canonical legacy data is still supported during Phase C migration.
  return Boolean(await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { userId: true },
  }));
}

export async function resolveOrganizationIdForClinic(clinicId: string): Promise<string | null> {
  if (!clinicId) return null;
  const organization = await prisma.organization.findFirst({ where: { originalType: 'Clinic', originalId: clinicId }, select: { id: true } });
  return organization?.id ?? null;
}

/** Resolve membership using the unified Person model first, then legacy ClinicMember. */
export async function resolveAnyClinicMembership(userId: string): Promise<{ clinicId: string; role: string } | null> {
  const person = await prisma.person.findFirst({
    where: { userId, organization: { type: 'CLINIC' } },
    orderBy: { createdAt: 'asc' },
    include: { organization: { select: { id: true, originalId: true } }, personRoles: { include: { role: true } } },
  });
  if (person?.organization?.originalId) {
    const role = person.organization?.id
      ? resolvePrimaryClinicRole(person.personRoles || [], person.organization.id)
      : undefined;
    if (role) return { clinicId: person.organization.originalId, role };
  }

  // Do not let a stale/roleless canonical Person fall through to an unrelated
  // legacy clinic membership. If the user has canonical clinic Persons, only
  // those organizations are eligible; legacy fallback is reserved for users
  // who have not entered the canonical clinic model yet.
  const canonicalClinicPerson = await prisma.person.findFirst({
    where: { userId, organization: { type: 'CLINIC' } },
    select: { id: true },
  });
  if (canonicalClinicPerson) return null;

  const member = await prisma.clinicMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } });
  return member ? { clinicId: member.clinicId, role: member.role } : null;
}

export async function hasOrgAccess(user: AuthUser | undefined | null, originalType: string, originalId: string): Promise<boolean> {
  if (!user || !originalId) return false;
  if (user.role === 'SUPERADMIN') return true;
  const organization = await prisma.organization.findFirst({ where: { originalType, originalId }, select: { id: true } });
  if (!organization) return false;
  return assertOrgAccess(user, organization.id);
}

export async function getUserPersons(userId: string) {
  return prisma.person.findMany({ where: { userId }, include: { organization: { select: { id: true, name: true, type: true } } } });
}

export const PERSON_ROLE_MAP: Record<string, string> = {
  org_admin: 'ADMIN', doctor: 'DOCTOR', nurse: 'ASSISTANT', cashier: 'ADMIN', lab: 'LAB',
  superadmin: 'SUPERADMIN', owner: 'OWNER', director: 'DIRECTOR', admin: 'ADMIN', manager: 'MANAGER',
  assistant: 'ASSISTANT', student: 'STUDENT', support: 'SUPPORT',
};

const CLINIC_ROLE_PRIORITY: Record<string, number> = {
  SUPERADMIN: 1000,
  OWNER: 900,
  DIRECTOR: 850,
  ADMIN: 800,
  MANAGER: 700,
  DOCTOR: 600,
  LAB: 500,
  ASSISTANT: 400,
  SUPPORT: 300,
  STUDENT: 200,
};

function resolvePrimaryClinicRole(personRoles: Array<{ scopeType: string | null; scopeId: string | null; role: { key: string } }>, organizationId: string): string | undefined {
  const mapped = personRoles
    .filter((pr) => pr.scopeType === 'organization' && pr.scopeId === organizationId)
    .map((pr) => PERSON_ROLE_MAP[pr.role.key.toLowerCase()])
    .filter((role): role is string => Boolean(role));
  mapped.sort((a, b) => (CLINIC_ROLE_PRIORITY[b] || 0) - (CLINIC_ROLE_PRIORITY[a] || 0));
  return mapped[0];
}

export async function resolveClinicAccess(userId: string, clinicId: string): Promise<{ role: string } | null> {
  if (!clinicId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role: 'SUPERADMIN' };
  const org = await prisma.organization.findFirst({ where: { originalType: 'Clinic', originalId: clinicId } });
  if (org) {
    const person = await prisma.person.findFirst({
      where: {
        userId,
        organizationId: org.id,
        personRoles: { some: { scopeType: 'organization', scopeId: org.id } },
      },
      include: { personRoles: { include: { role: true } } },
    });
    if (person) {
      const mapped = resolvePrimaryClinicRole(person.personRoles || [], org.id);
      if (mapped) return { role: mapped };
    }
  }
  // A canonical organization exists, so legacy membership cannot authorize a
  // user who lacks an organization-scoped PersonRole.
  if (org) return null;
  const member = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId, clinicId } } });
  return member ? { role: member.role } : null;
}


/**
 * Authorize a domain Clinic.id against the canonical Organization/PersonRole
 * scope, with a legacy ClinicMember fallback only when the organization has not
 * been canonicalized yet.
 */
export async function assertClinicOrgAccess(user: AuthUser, clinicId: string): Promise<boolean> {
  if (!user || !clinicId) return false;
  if (user.role === 'SUPERADMIN') return true;
  const organizationId = await resolveOrganizationIdForClinic(clinicId);
  return assertOrgAccess(user, organizationId || clinicId);
}
