import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/lib/permissions.js';
import { CLINIC_ROLE_DEFINITIONS } from '../src/lib/clinicRoleAccessRegistry.js';
import { PARTNER_ROLE_DEFINITIONS } from '../src/lib/roleAccessRegistry.js';

const prisma = new PrismaClient();

const LEGACY_ROLES: { key: string; name: string; description: string; permissionKeys: string[] }[] = [
  { key: 'org_admin', name: 'Организация — администратор', description: 'Full access within one organization', permissionKeys: ROLE_PERMISSIONS['ADMIN'] },
  { key: 'nurse', name: 'Ассистент / Медсестра', description: 'Support clinical access', permissionKeys: ROLE_PERMISSIONS['ASSISTANT'] },
  { key: 'seller', name: 'Продавец (поставщик)', description: 'Supplier management access', permissionKeys: ['supplier.manage', 'shop.manage', 'shop.read', 'inventory.read'] },
  { key: 'lecturer', name: 'Лектор', description: 'Academy course management', permissionKeys: ['academy.manage', 'academy.read'] },
];

const CLINIC_ROLES = CLINIC_ROLE_DEFINITIONS.map((definition) => ({
  key: definition.key.toLowerCase(),
  name: definition.label,
  description: definition.description,
  permissionKeys: [...definition.permissions],
}));

const PARTNER_ROLES = PARTNER_ROLE_DEFINITIONS.map((definition) => ({
  key: definition.key.toLowerCase(),
  name: definition.label,
  description: definition.description,
  permissionKeys: [...definition.permissions],
}));

const ALL_PERMISSIONS: string[] = [
  ...new Set([
    ...Object.values(PERMISSIONS),
    ...Object.values(ROLE_PERMISSIONS).flat(),
    ...LEGACY_ROLES.flatMap((r) => r.permissionKeys),
    ...CLINIC_ROLES.flatMap((r) => r.permissionKeys),
    ...PARTNER_ROLES.flatMap((r) => r.permissionKeys),
  ]),
];
const permissionDomain = (key: string) => key.split('.')[0];

const CANONICAL_ROLES = Object.keys(ROLE_PERMISSIONS).map((role) => ({
  key: role.toLowerCase(),
  name: role,
  description: `System role: ${role}`,
  permissionKeys: ROLE_PERMISSIONS[role],
}));

const SUPERADMIN_ROLE = {
  key: 'superadmin',
  name: 'Суперадминистратор',
  description: 'Full platform access — all permissions',
  permissionKeys: ALL_PERMISSIONS,
};

const E2E_PARTNER_PASSWORD = 'Test1234!';

const E2E_PARTNER_FIXTURES = [
  { email: 'diagnostic-owner@test.com', organizationType: 'DIAGNOSTIC_CENTER', organizationName: 'E2E Diagnostic Center', role: 'diagnostic_owner' },
  { email: 'diagnostic-operator@test.com', organizationType: 'DIAGNOSTIC_CENTER', organizationName: 'E2E Diagnostic Center', role: 'diagnostic_operator' },
  { email: 'medical-lab-owner@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Medical Laboratory', role: 'medical_lab_owner' },
  { email: 'medical-lab-tech@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Medical Laboratory', role: 'medical_lab_technician' },
  { email: 'dental-lab-owner@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Dental Laboratory', role: 'dental_lab_owner' },
  { email: 'dental-technician@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Dental Laboratory', role: 'dental_technician' },
  { email: 'lecturer@test.com', organizationType: 'ACADEMY', organizationName: 'E2E Academy', role: 'lecturer' },
] as const;

async function seedE2EPartnerFixtures() {
  for (const fixture of E2E_PARTNER_FIXTURES) {
    // Keep the fixture self-healing: a missing user must never silently skip
    // the canonical Person/PersonRole graph and leave /api/iam/me/contexts empty.
    const password = await bcrypt.hash(E2E_PARTNER_PASSWORD, 10);
    const user = await prisma.user.upsert({
      where: { email: fixture.email },
      update: { password, role: 'STUDENT' },
      create: {
        id: randomUUID(),
        email: fixture.email,
        password,
        firstName: fixture.email.split('@')[0],
        lastName: 'E2E',
        role: 'STUDENT',
      },
      select: { id: true },
    });

    const organization = await prisma.organization.upsert({
      where: { id: (await prisma.organization.findFirst({ where: { type: fixture.organizationType, name: fixture.organizationName }, select: { id: true } }))?.id || randomUUID() },
      update: { type: fixture.organizationType, name: fixture.organizationName },
      create: {
        id: randomUUID(),
        name: fixture.organizationName,
        type: fixture.organizationType,
        originalType: 'E2E',
      },
    });

    const person = await prisma.person.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: { fullName: fixture.email, personType: 'STAFF', email: fixture.email },
      create: {
        id: randomUUID(),
        fullName: fixture.email,
        personType: 'STAFF',
        organizationId: organization.id,
        userId: user.id,
        email: fixture.email,
      },
    });

    const role = await prisma.role.findUniqueOrThrow({ where: { key: fixture.role } });
    const scopeKey = `organization:${organization.id}`;
    await prisma.personRole.upsert({
      where: { personId_roleId_scopeKey: { personId: person.id, roleId: role.id, scopeKey } },
      update: { scopeType: 'organization', scopeId: organization.id },
      create: { id: randomUUID(), personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organization.id, scopeKey },
    });

    const verified = await prisma.personRole.findFirst({
      where: { personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organization.id, scopeKey },
      select: { id: true },
    });
    if (!verified) throw new Error(`E2E partner PersonRole was not persisted for ${fixture.email}`);

    // Keep the canonical Organization context and the legacy partner tables
    // in sync. Partner workspaces still resolve their operational scope from
    // DiagnosticCenterMember/LaboratoryMember, so the E2E identity must have
    // a real partner record instead of only a PersonRole.
    if (fixture.organizationType === 'DIAGNOSTIC_CENTER') {
      const center = await prisma.diagnosticCenter.findFirst({ where: { name: fixture.organizationName } });
      const diagnosticCenter = center ?? await prisma.diagnosticCenter.create({
        data: { id: randomUUID(), name: fixture.organizationName, city: 'Алматы', active: true },
      });
      await prisma.organization.update({ where: { id: organization.id }, data: { originalType: 'DiagnosticCenter', originalId: diagnosticCenter.id } });
      await prisma.diagnosticCenterMember.upsert({
        where: { centerId_userId: { centerId: diagnosticCenter.id, userId: user.id } },
        update: { role: fixture.role === 'diagnostic_owner' ? 'admin' : 'operator' },
        create: { id: randomUUID(), centerId: diagnosticCenter.id, userId: user.id, role: fixture.role === 'diagnostic_owner' ? 'admin' : 'operator' },
      });
    }

    if (fixture.organizationType === 'LABORATORY') {
      const lab = await prisma.laboratory.findFirst({ where: { name: fixture.organizationName } });
      const laboratory = lab ?? await prisma.laboratory.create({
        data: { id: randomUUID(), name: fixture.organizationName, city: 'Алматы', active: true },
      });
      await prisma.organization.update({ where: { id: organization.id }, data: { originalType: 'Laboratory', originalId: laboratory.id } });
      await prisma.laboratoryMember.upsert({
        where: { labId_userId: { labId: laboratory.id, userId: user.id } },
        update: { role: fixture.role.endsWith('_owner') ? 'admin' : 'technician' },
        create: { id: randomUUID(), labId: laboratory.id, userId: user.id, role: fixture.role.endsWith('_owner') ? 'admin' : 'technician' },
      });
    }

    if (fixture.organizationType === 'ACADEMY') {
      const academy = await prisma.academy.findFirst({ where: { name: fixture.organizationName } });
      const academyRecord = academy ?? await prisma.academy.create({
        data: { id: randomUUID(), name: fixture.organizationName, city: 'Алматы' },
      });
      await prisma.organization.update({
        where: { id: organization.id },
        data: { originalType: 'Academy', originalId: academyRecord.id },
      });
      await prisma.lecturer.upsert({
        where: { userId: user.id },
        update: { academyId: academyRecord.id },
        create: { id: randomUUID(), userId: user.id, academyId: academyRecord.id, level: 'new' },
      });
    }

    const persistedUser = await prisma.user.findUnique({ where: { email: fixture.email }, select: { id: true } });
    const persistedPerson = await prisma.person.findFirst({
      where: { userId: user.id, organizationId: organization.id },
      select: { id: true },
    });
    const persistedPersonRole = await prisma.personRole.findFirst({
      where: { personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organization.id, scopeKey },
      select: { id: true },
    });
    const persistedMembership = fixture.organizationType === 'DIAGNOSTIC_CENTER'
      ? await prisma.diagnosticCenterMember.findFirst({ where: { userId: user.id }, select: { id: true } })
      : fixture.organizationType === 'LABORATORY'
        ? await prisma.laboratoryMember.findFirst({ where: { userId: user.id }, select: { id: true } })
        : await prisma.lecturer.findFirst({ where: { userId: user.id, academyId: organization.originalId || undefined }, select: { id: true } });
    if (!persistedUser || !persistedPerson || !persistedPersonRole || !persistedMembership) {
      throw new Error(`E2E partner graph incomplete for ${fixture.email}: user=${Boolean(persistedUser)} person=${Boolean(persistedPerson)} personRole=${Boolean(persistedPersonRole)} membership=${Boolean(persistedMembership)}`);
    }
    const canonicalVerification = await prisma.personRole.findFirst({
      where: {
        personId: person.id,
        roleId: role.id,
        scopeType: 'organization',
        scopeId: organization.id,
        scopeKey,
      },
      select: { id: true },
    });
    if (!canonicalVerification) {
      throw new Error(`Canonical partner PersonRole verification failed for ${fixture.email}: organization=${organization.id} role=${fixture.role}`);
    }

    console.log(`  ✓ partner ${fixture.email} -> ${fixture.role} -> organization:${organization.id}`);


  }
}

function resolveClinicRoleKey(role: string | null | undefined): string | null {
  const normalized = String(role || '').trim().toUpperCase();
  const aliases: Record<string, string> = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MANAGER: 'manager',
    DOCTOR: 'doctor',
    ASSISTANT: 'assistant',
    RECEPTIONIST: 'receptionist',
    RECEPTION: 'receptionist',
    CASHIER: 'cashier',
    ACCOUNTANT: 'accountant',
    LAB: 'lab',
  };
  return aliases[normalized] ?? null;
}

async function seedE2EClinicCanonicalContexts() {
  const clinicMembers = await prisma.clinicMember.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      clinic: { select: { id: true, name: true, address: true, phone: true, logo: true, city: true } },
    },
  });

  for (const member of clinicMembers) {
    const organization = await prisma.organization.upsert({
      where: { originalType_originalId: { originalType: 'Clinic', originalId: member.clinicId } },
      update: {
        name: member.clinic.name,
        type: 'CLINIC',
        address: member.clinic.address || undefined,
        phone: member.clinic.phone || undefined,
        logo: member.clinic.logo || undefined,
        contacts: member.clinic.city ? { city: member.clinic.city } : undefined,
      },
      create: {
        id: randomUUID(),
        name: member.clinic.name,
        type: 'CLINIC',
        address: member.clinic.address || undefined,
        phone: member.clinic.phone || undefined,
        logo: member.clinic.logo || undefined,
        contacts: member.clinic.city ? { city: member.clinic.city } : undefined,
        originalType: 'Clinic',
        originalId: member.clinicId,
      },
    });

    const person = await prisma.person.upsert({
      where: { userId_organizationId: { userId: member.userId, organizationId: organization.id } },
      update: {
        fullName: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email,
        email: member.user.email,
        personType: 'DOCTOR',
      },
      create: {
        id: randomUUID(),
        fullName: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email,
        email: member.user.email,
        personType: 'DOCTOR',
        organizationId: organization.id,
        userId: member.userId,
        originalType: 'ClinicMember',
        originalId: member.id,
      },
    });

    const roleKey = resolveClinicRoleKey(member.role);
    if (!roleKey) {
      console.warn('  ⚠ canonical clinic role not recognized for ' + member.user.email + '; skipping');
      continue;
    }

    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      console.warn('  ⚠ canonical clinic Role ' + roleKey + ' is missing for ' + member.user.email + '; skipping');
      continue;
    }

    const scopeKey = 'organization:' + organization.id;
    await prisma.personRole.upsert({
      where: { personId_roleId_scopeKey: { personId: person.id, roleId: role.id, scopeKey } },
      update: { scopeType: 'organization', scopeId: organization.id },
      create: {
        id: randomUUID(),
        personId: person.id,
        roleId: role.id,
        scopeType: 'organization',
        scopeId: organization.id,
        scopeKey,
      },
    });

    const persisted = await prisma.personRole.findFirst({
      where: {
        personId: person.id,
        roleId: role.id,
        scopeType: 'organization',
        scopeId: organization.id,
        scopeKey,
      },
      select: { id: true },
    });
    if (!persisted) {
      throw new Error('Canonical clinic PersonRole verification failed for ' + member.user.email);
    }

    console.log('  ✓ clinic ' + member.user.email + ' -> ' + roleKey + ' -> organization:' + organization.id);
  }
}

export async function seedPermissions() {
  console.log('[SEED] Seeding permissions...');

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { name: key, domain: permissionDomain(key) },
      create: { key, name: key, domain: permissionDomain(key) },
    });
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`);

  console.log('[SEED] Seeding roles...');
  for (const r of [...CANONICAL_ROLES, SUPERADMIN_ROLE, ...LEGACY_ROLES, ...CLINIC_ROLES, ...PARTNER_ROLES]) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });

    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissionKeys } },
      select: { id: true },
    });

    // Reconcile by primary-key IDs rather than a relation-filtered
    // NOT IN query. Production can accumulate a large role_permissions table;
    // the composite PK (roleId, permissionId) makes these explicit ID lookups
    // predictable and avoids a long table scan during every Render rollout.
    const desiredPermissionIds = new Set(perms.map((perm) => perm.id));
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true },
    });
    const stalePermissionIds = existing
      .map((row) => row.permissionId)
      .filter((permissionId) => !desiredPermissionIds.has(permissionId));

    if (stalePermissionIds.length) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: stalePermissionIds } },
      });
    }

    const existingPermissionIds = new Set(existing.map((row) => row.permissionId));
    const missing = perms.filter((perm) => !existingPermissionIds.has(perm.id));
    if (missing.length) {
      await prisma.rolePermission.createMany({
        data: missing.map((perm) => ({ roleId: role.id, permissionId: perm.id })),
        skipDuplicates: true,
      });
    }
    console.log(`  ✓ ${r.key} — ${perms.length} permissions`);
  }

  // E2E identities and organizations belong only to isolated test databases.
  // Production must never acquire test users or synthetic partner organizations.
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_E2E_FIXTURES === 'true') {
    await seedE2EClinicCanonicalContexts();
    await seedE2EPartnerFixtures();
  } else {
    console.log('[SEED] Skipping E2E clinic/partner fixtures outside an explicit test seed.');
  }
}

async function main() {
  await seedPermissions();
  console.log('[SEED] Permissions seeding complete.');
}

main()
  .catch((e) => {
    console.error('[SEED] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
