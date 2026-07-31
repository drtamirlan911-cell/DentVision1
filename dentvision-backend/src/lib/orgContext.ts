import prisma from './prisma.js';
import type { AuthUser } from '../types/index.js';

/**
 * Resolve the effective organization context for a user.
 * Returns organizationId (clinicId fallback), organization, and person.
 */
export async function resolveOrgContext(user: AuthUser) {
  const orgId = user.organizationId || user.clinicId;
  if (!orgId) return { orgId: null, organization: null, person: null };

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  // If not found in Organization, try Clinic as fallback
  if (!organization && user.clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: user.clinicId } });
    if (clinic) {
      return {
        orgId: user.clinicId,
        organization: { id: clinic.id, name: clinic.name, type: 'CLINIC' },
        person: null,
      };
    }
  }

  const person = await prisma.person.findFirst({
    where: { userId: user.id, organizationId: orgId },
  });

  return { orgId, organization, person };
}

/**
 * Get the effective clinicId from a user's context.
 * If the org is a CLINIC, returns its id; otherwise tries user.clinicId.
 */
export function getClinicId(user: AuthUser): string | undefined {
  if (user.organizationType === 'CLINIC' && user.organizationId) {
    return user.organizationId;
  }
  return user.clinicId;
}

/**
 * Assert that a user belongs to the given organization (via Person or ClinicMember).
 */
export async function assertOrgAccess(user: AuthUser, orgId: string): Promise<boolean> {
  if (user.role === 'SUPERADMIN') return true;

  // Check Person table (unified)
  const person = await prisma.person.findFirst({
    where: { userId: user.id, organizationId: orgId },
  });
  if (person) return true;

  // Check ClinicMember (legacy)
  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId: user.id, clinicId: orgId } },
  });
  if (member) return true;

  return false;
}

/**
 * All person records for a user across all orgs.
 */
export async function getUserPersons(userId: string) {
  return prisma.person.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, type: true } } },
  });
}

const PERSON_ROLE_MAP: Record<string, string> = {
  org_admin: 'ADMIN', doctor: 'DOCTOR', nurse: 'ASSISTANT',
  cashier: 'ADMIN', lab: 'LAB', lecturer: 'DOCTOR',
  seller: 'DOCTOR', superadmin: 'SUPERADMIN',
};

/**
 * Universal clinic access resolver — checks Person (unified) then ClinicMember (legacy).
 * Returns role or null. Handles SUPERADMIN pass-through.
 */
export async function resolveClinicAccess(userId: string, clinicId: string): Promise<{ role: string } | null> {
  if (!clinicId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role: 'SUPERADMIN' };

  const org = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
  });
  if (org) {
    const person = await prisma.person.findFirst({
      where: { userId, organizationId: org.id },
      include: { personRoles: { include: { role: true } } },
    });
    if (person) {
      const unifiedRole = person.personRoles?.[0]?.role?.key || 'org_admin';
      return { role: PERSON_ROLE_MAP[unifiedRole] || 'DOCTOR' };
    }
  }

  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
  });
  if (member) return { role: member.role };

  return null;
}

/**
 * Check role membership (any of the given roles) — wraps resolveClinicAccess.
 */
export async function assertClinicRole(userId: string, clinicId: string, allowedRoles: string[]) {
  const access = await resolveClinicAccess(userId, clinicId);
  if (!access) throw Object.assign(new Error('Нет доступа к клинике'), { status: 403 });
  if (access.role === 'SUPERADMIN') return access;
  if (!allowedRoles.includes(access.role)) throw Object.assign(new Error('Недостаточно прав'), { status: 403 });
  return access;
}
