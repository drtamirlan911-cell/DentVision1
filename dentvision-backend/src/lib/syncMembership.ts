import prisma from './prisma.js';
import { uid } from './helpers.js';

const CM_ROLE_TO_ROLE_KEY: Record<string, string> = {
  OWNER: 'owner',
  DIRECTOR: 'director',
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  ASSISTANT: 'assistant',
  MANAGER: 'manager',
  LAB: 'lab',
  STUDENT: 'student',
  SUPPLIER: 'seller',
  LECTURER: 'lecturer',
  CASHIER: 'cashier',
  SUPERADMIN: 'superadmin',
  SUPPORT: 'support',
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

  // Person.userId is globally unique. Reuse the existing Person when it's the
  // same ClinicMember, otherwise skip — never steal a Person that belongs to
  // another org (e.g. diagnostics center) or a duplicate userId row would be created.
  let person = await prisma.person.findFirst({
    where: { originalType: 'ClinicMember', originalId: `${clinicId}:${userId}` },
  });
  if (!person) {
    const existingByUser = await prisma.person.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (existingByUser) return;
    person = await prisma.person.create({
      data: {
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
  } else {
    await prisma.person.update({
      where: { id: person.id },
      data: {
        fullName,
        personType,
        organizationId: org.id,
        specialization: user.spec || undefined,
        phone: user.phone || undefined,
      },
    });
  }

  // Assign unified role. Unrecognized roles are never granted a fallback
  // role (that used to silently grant 'owner') — the Person is still
  // created/updated above, so callers fall back to the legacy ClinicMember
  // role via resolveClinicAccess() until this map is fixed.
  const roleKey = CM_ROLE_TO_ROLE_KEY[role];
  if (!roleKey) {
    console.error(`[syncPersonFromClinicMember] Unrecognized ClinicMember role '${role}' for user ${userId} in clinic ${clinicId} — skipping PersonRole assignment`);
    return;
  }
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
 * Keep Person in sync with a SupplierMember (marketplace seller staff).
 * originalId is the SupplierMember row's own id (matches the backfill in
 * prisma/migrate-unified-schema.ts, which upserts by `sm.id`, not a composite key).
 */
export async function syncPersonFromSupplierMember(memberId: string, supplierId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  if (!user) return;

  const org = await prisma.organization.findFirst({
    where: { originalType: 'Supplier', originalId: supplierId },
  });
  if (!org) return;

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  let person = await prisma.person.findFirst({
    where: { originalType: 'SupplierMember', originalId: memberId },
  });
  if (!person) {
    const existingByUser = await prisma.person.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (existingByUser) return;
    person = await prisma.person.create({
      data: {
        id: uid(),
        fullName,
        personType: 'SUPPLIER_REP',
        organizationId: org.id,
        userId: user.id,
        phone: user.phone || undefined,
        email: user.email || undefined,
        originalType: 'SupplierMember',
        originalId: memberId,
      },
    });
  } else {
    await prisma.person.update({
      where: { id: person.id },
      data: {
        fullName,
        personType: 'SUPPLIER_REP',
        organizationId: org.id,
        phone: user.phone || undefined,
        email: user.email || undefined,
      },
    });
  }

  const dbRole = await prisma.role.findUnique({ where: { key: 'seller' } });
  if (dbRole) {
    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: dbRole.id } },
      update: {},
      create: { personId: person.id, roleId: dbRole.id },
    });
  }
}

/**
 * Remove Person record when a SupplierMember is deleted.
 */
export async function removePersonFromSupplierMember(memberId: string): Promise<void> {
  await prisma.person.deleteMany({
    where: { originalType: 'SupplierMember', originalId: memberId },
  });
}

/**
 * Keep Person in sync with a Lecturer profile.
 * originalId is the Lecturer row's own id (matches the backfill).
 */
export async function syncPersonFromLecturer(lecturerId: string, userId: string, academyId?: string | null): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  if (!user) return;

  const org = academyId
    ? await prisma.organization.findFirst({ where: { originalType: 'Academy', originalId: academyId } })
    : null;

  const fullName = `${user.firstName} ${user.lastName}`.trim() || `Lecturer ${lecturerId}`;

  let person = await prisma.person.findFirst({
    where: { originalType: 'Lecturer', originalId: lecturerId },
  });
  if (!person) {
    const existingByUser = await prisma.person.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (existingByUser) return;
    person = await prisma.person.create({
      data: {
        id: uid(),
        fullName,
        personType: 'LECTURER',
        organizationId: org?.id,
        userId: user.id,
        phone: user.phone || undefined,
        email: user.email || undefined,
        originalType: 'Lecturer',
        originalId: lecturerId,
      },
    });
  } else {
    await prisma.person.update({
      where: { id: person.id },
      data: {
        fullName,
        personType: 'LECTURER',
        organizationId: org?.id,
        phone: user.phone || undefined,
        email: user.email || undefined,
      },
    });
  }

  const dbRole = await prisma.role.findUnique({ where: { key: 'lecturer' } });
  if (dbRole) {
    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: dbRole.id } },
      update: {},
      create: { personId: person.id, roleId: dbRole.id },
    });
  }
}

/**
 * Give a platform SUPPORT user a platform-scoped Person + PersonRole('support').
 * Mirrors migrateSuperAdmins() in prisma/migrate-unified-schema.ts (same pattern
 * for SUPERADMIN), keyed the same way: originalType 'User', originalId = user id.
 */
export async function syncPersonFromSupportUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!user) return;

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'Support';

  let person = await prisma.person.findFirst({
    where: { originalType: 'User', originalId: userId },
  });
  if (!person) {
    const existingByUser = await prisma.person.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (existingByUser) return;
    person = await prisma.person.create({
      data: {
        id: uid(),
        fullName,
        personType: 'PLATFORM_SUPPORT',
        userId: user.id,
        email: user.email || undefined,
        originalType: 'User',
        originalId: userId,
      },
    });
  } else {
    await prisma.person.update({
      where: { id: person.id },
      data: { fullName, personType: 'PLATFORM_SUPPORT', email: user.email || undefined },
    });
  }

  const dbRole = await prisma.role.findUnique({ where: { key: 'support' } });
  if (dbRole) {
    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: dbRole.id } },
      update: {},
      create: { personId: person.id, roleId: dbRole.id, scopeType: 'platform' },
    });
  }
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
