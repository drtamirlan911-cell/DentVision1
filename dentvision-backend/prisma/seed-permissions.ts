import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/lib/permissions.js';

const prisma = new PrismaClient();

// Legacy alias roles referenced by src/lib/syncMembership.ts and existing
// PersonRole assignments. They reuse permissions from the unified catalog so
// old rows keep resolving against the new vocabulary.
const LEGACY_ROLES: { key: string; name: string; description: string; permissionKeys: string[] }[] = [
  {
    key: 'org_admin',
    name: 'Организация — администратор',
    description: 'Full access within one organization',
    permissionKeys: ROLE_PERMISSIONS['ADMIN'],
  },
  {
    key: 'nurse',
    name: 'Ассистент / Медсестра',
    description: 'Support clinical access',
    permissionKeys: ROLE_PERMISSIONS['ASSISTANT'],
  },
  {
    key: 'seller',
    name: 'Продавец (поставщик)',
    description: 'Supplier management access',
    permissionKeys: ['supplier.manage', 'inventory.read'],
  },
  {
    key: 'lecturer',
    name: 'Лектор',
    description: 'Academy course management',
    permissionKeys: ['academy.manage'],
  },
];

// Unified permission catalog (domain.action) — single source of truth is
// src/lib/permissions.ts. Domain is derived from the key prefix.
// IMPORTANT: PERMISSIONS (legacy compat) is NOT exhaustive — many role-matrix
// keys like medical.read or lab.write only exist in ROLE_PERMISSIONS.  The
// catalog MUST include every key the matrix produces so that `findMany` in
// the role-linking loop below actually finds Permission rows for each key.
const ALL_PERMISSIONS: string[] = [
  ...new Set([
    ...Object.values(PERMISSIONS),
    ...Object.values(ROLE_PERMISSIONS).flat(),
    ...LEGACY_ROLES.flatMap(r => r.permissionKeys),
  ]),
];
const permissionDomain = (key: string) => key.split('.')[0];

// Canonical roles derived from ROLE_PERMISSIONS, keyed by the lowercase backend
// role name so the DB lookup in GET /api/iam/permissions (role.toLowerCase())
// and the Person → PersonRole → Role → Permission path in requirePermission
// resolve consistently.
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

export async function seedPermissions() {
  console.log('[SEED] Seeding permissions...');

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { name: key, domain: permissionDomain(key) },
      create: { key, name: key, domain: permissionDomain(key) },
    });
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions (${permissionDomain(ALL_PERMISSIONS[0])}.* …)`);

  console.log('[SEED] Seeding roles...');
  for (const r of [...CANONICAL_ROLES, SUPERADMIN_ROLE, ...LEGACY_ROLES]) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });

    // Remove stale links (old vocabulary) so the role converges to the catalog.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permission: { key: { notIn: r.permissionKeys } } },
    });

    // Link permissions (idempotent).
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
