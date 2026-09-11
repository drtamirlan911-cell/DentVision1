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
  const person = await prisma.person.findFirst({ where: { userId: user.id, organizationId: orgId } });
  if (person) return true;
  const member = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId: user.id, clinicId: orgId } } });
  return Boolean(member);
}

export async function isClinicMember(userId: string, clinicId: string): Promise<boolean> {
  return Boolean(await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId, clinicId } }, select: { userId: true } }));
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
    include: { organization: { select: { originalId: true } }, personRoles: { include: { role: true } } },
  });
  if (person?.organization?.originalId) {
    const key = person.personRoles?.[0]?.role?.key;
    const role = key ? PERSON_ROLE_MAP[key] : undefined;
    if (role) return { clinicId: person.organization.originalId, role };
  }
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

export async function resolveClinicAccess(userId: string, clinicId: string): Promise<{ role: string } | null> {
  if (!clinicId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role: 'SUPERADMIN' };
  const org = await prisma.organization.findFirst({ where: { originalType: 'Clinic', originalId: clinicId } });
  if (org) {
    const person = await prisma.person.findFirst({ where: { userId, organizationId: org.id }, include: { personRoles: { include: { role: true } } } });
    if (person) {
      const unifiedRole = person.personRoles?.[0]?.role?.key;
      const mapped = unifiedRole ? PERSON_ROLE_MAP[unifiedRole] : undefined;
      if (mapped) return { role: mapped };
    }
  }
  const member = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId, clinicId } } });
  return member ? { role: member.role } : null;
}
