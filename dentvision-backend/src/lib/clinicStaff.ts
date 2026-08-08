/**
 * Everyone who works at a clinic, from both models.
 *
 * Enumerating `clinicMember` alone omits staff that exist only in the unified
 * model — they simply did not appear in the clinic payroll run. This unions
 * both sources and de-duplicates by user, preferring the legacy row's role when
 * both exist (that is the column staff CRUD still writes).
 */

import prisma from './prisma.js';
import { resolveOrganizationIdForClinic } from './orgContext.js';

export interface ClinicStaffMember {
  userId: string;
  name: string;
  role: string;
  source: 'clinicMember' | 'person';
}

const PERSON_ROLE_TO_LEGACY: Record<string, string> = {
  org_admin: 'ADMIN', doctor: 'DOCTOR', nurse: 'ASSISTANT',
  cashier: 'CASHIER', lab: 'LAB', owner: 'OWNER', director: 'DIRECTOR',
  admin: 'ADMIN', manager: 'MANAGER', assistant: 'ASSISTANT',
  student: 'STUDENT', support: 'SUPPORT',
};

export async function listClinicStaff(clinicId: string): Promise<ClinicStaffMember[]> {
  const members = await prisma.clinicMember.findMany({
    where: { clinicId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const staff: ClinicStaffMember[] = members.map((m) => ({
    userId: m.userId,
    name: `${m.user.firstName} ${m.user.lastName}`.trim(),
    role: m.role,
    source: 'clinicMember',
  }));
  const seen = new Set(staff.map((s) => s.userId));

  const organizationId = await resolveOrganizationIdForClinic(clinicId);
  if (!organizationId) return staff;

  const persons = await prisma.person.findMany({
    where: { organizationId, userId: { not: null } },
    include: { personRoles: { include: { role: true } } },
  });

  for (const person of persons) {
    if (!person.userId || seen.has(person.userId)) continue;
    seen.add(person.userId);
    const roleKey = person.personRoles?.[0]?.role?.key;
    staff.push({
      userId: person.userId,
      name: person.fullName,
      role: (roleKey && PERSON_ROLE_TO_LEGACY[roleKey]) || 'DOCTOR',
      source: 'person',
    });
  }

  return staff;
}
