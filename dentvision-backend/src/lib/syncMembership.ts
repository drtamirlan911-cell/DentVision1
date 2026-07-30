import prisma from './prisma.js';
import { uid } from './helpers.js';

const CM_ROLE_TO_ROLE_KEY: Record<string, string> = {
  OWNER: 'org_admin',
  DIRECTOR: 'org_admin',
  ADMIN: 'org_admin',
  DOCTOR: 'doctor',
  ASSISTANT: 'nurse',
  MANAGER: 'org_admin',
  LAB: 'lab',
  STUDENT: 'nurse',
  SUPPLIER: 'seller',
  LECTURER: 'lecturer',
};

/**
 * Keep Person ↔ ClinicMember in sync.
 * Call this whenever a ClinicMember is created/updated/deleted.
 */
export async function syncPersonFromClinicMember(clinicId: string, userId: string, role: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true, spec: true },
  });
  if (!user) return;

  const org = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
  });
  if (!org) return;

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const personType = role === 'DOCTOR' ? 'DOCTOR' : 'STAFF';

  const person = await prisma.person.upsert({
    where: { originalType_originalId: { originalType: 'ClinicMember', originalId: `${clinicId}:${userId}` } },
    update: {
      fullName,
      personType,
      specialization: user.spec || undefined,
      phone: user.phone || undefined,
    },
    create: {
      id: uid(),
      fullName,
      personType,
      organizationId: org.id,
      userId: user.id,
      specialization: user.spec || undefined,
      phone: user.phone || undefined,
      originalType: 'ClinicMember',
      originalId: `${clinicId}:${userId}`,
    },
  });

  // Assign unified role
  const roleKey = CM_ROLE_TO_ROLE_KEY[role] || 'org_admin';
  const dbRole = await prisma.role.findUnique({ where: { key: roleKey } });
  if (dbRole) {
    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: dbRole.id } },
      update: {},
      create: { personId: person.id, roleId: dbRole.id },
    });
  }
}

/**
 * Remove Person record when ClinicMember is deleted.
 */
export async function removePersonFromClinicMember(clinicId: string, userId: string): Promise<void> {
  await prisma.person.deleteMany({
    where: { originalType: 'ClinicMember', originalId: `${clinicId}:${userId}` },
  });
}

/**
 * Find a user's membership in an org — checks Person first, then ClinicMember.
 */
export async function findOrgMembership(userId: string, orgId: string) {
  // Try unified Person
  const person = await prisma.person.findFirst({
    where: { userId, organizationId: orgId },
  });
  if (person) return { source: 'person' as const, person };

  // Try legacy ClinicMember (org might be a clinic)
  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId: orgId } },
  });
  if (member) return { source: 'clinicMember' as const, member };

  return null;
}

/**
 * Ensure a Person record exists for every ClinicMember (bulk sync).
 */
export async function syncAllClinicMembersToPersons(): Promise<number> {
  const members = await prisma.clinicMember.findMany({ include: { user: true } });
  let count = 0;
  for (const m of members) {
    await syncPersonFromClinicMember(m.clinicId, m.userId, m.role);
    count++;
  }
  return count;
}
