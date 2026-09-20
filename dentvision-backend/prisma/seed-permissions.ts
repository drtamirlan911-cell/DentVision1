import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

const E2E_PARTNER_FIXTURES = [
  { email: 'diagnostic-owner@test.com', organizationType: 'DIAGNOSTIC_CENTER', organizationName: 'E2E Diagnostic Center', role: 'diagnostic_owner' },
  { email: 'diagnostic-operator@test.com', organizationType: 'DIAGNOSTIC_CENTER', organizationName: 'E2E Diagnostic Center', role: 'diagnostic_operator' },
  { email: 'medical-lab-owner@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Medical Laboratory', role: 'medical_lab_owner' },
  { email: 'medical-lab-tech@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Medical Laboratory', role: 'medical_lab_technician' },
  { email: 'dental-lab-owner@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Dental Laboratory', role: 'dental_lab_owner' },
  { email: 'dental-technician@test.com', organizationType: 'LABORATORY', organizationName: 'E2E Dental Laboratory', role: 'dental_technician' },
] as const;

async function seedE2EPartnerFixtures() {
  for (const fixture of E2E_PARTNER_FIXTURES) {
    const user = await prisma.user.findUnique({ where: { email: fixture.email }, select: { id: true } });
    if (!user) continue;

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
    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: role.id } },
      update: { scopeType: 'organization', scopeId: organization.id },
      create: { id: randomUUID(), personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organization.id },
    });
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

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { key: { notIn: r.permissionKeys } } },
    });

    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissionKeys } },
    });
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log(`  ✓ ${r.key} — ${perms.length} permissions`);
  }

  await seedE2EPartnerFixtures();
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
