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
