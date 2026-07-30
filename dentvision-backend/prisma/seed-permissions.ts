import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_PERMISSIONS = [
  // CRM / Patients
  { key: 'patients:read', name: 'Read patients', domain: 'crm' },
  { key: 'patients:write', name: 'Create / edit patients', domain: 'crm' },
  { key: 'patients:delete', name: 'Delete patients', domain: 'crm' },
  { key: 'patients:export', name: 'Export patient data', domain: 'crm' },
  // Appointments
  { key: 'appointments:read', name: 'View appointments', domain: 'crm' },
  { key: 'appointments:write', name: 'Create / edit appointments', domain: 'crm' },
  { key: 'appointments:delete', name: 'Cancel / delete appointments', domain: 'crm' },
  // Medical records
  { key: 'medical:read', name: 'View medical records', domain: 'crm' },
  { key: 'medical:write', name: 'Create / edit medical records', domain: 'crm' },
  // Finance
  { key: 'finance:read', name: 'View financial data', domain: 'finance' },
  { key: 'finance:write', name: 'Create invoices / payments', domain: 'finance' },
  { key: 'finance:delete', name: 'Delete / void financial entries', domain: 'finance' },
  // Inventory
  { key: 'inventory:read', name: 'View inventory', domain: 'crm' },
  { key: 'inventory:write', name: 'Manage inventory', domain: 'crm' },
  // AI
  { key: 'ai:query', name: 'Use AI assistant', domain: 'ai' },
  { key: 'ai:admin', name: 'Manage AI settings', domain: 'ai' },
  // Settings
  { key: 'settings:read', name: 'View organization settings', domain: 'settings' },
  { key: 'settings:write', name: 'Edit organization settings', domain: 'settings' },
  // Staff
  { key: 'staff:read', name: 'View staff', domain: 'settings' },
  { key: 'staff:write', name: 'Manage staff', domain: 'settings' },
  // Platform admin
  { key: 'admin:users', name: 'Manage all users', domain: 'admin' },
  { key: 'admin:organizations', name: 'Manage all organizations', domain: 'admin' },
  { key: 'admin:billing', name: 'Manage platform billing', domain: 'admin' },
  { key: 'admin:compliance', name: 'Manage compliance', domain: 'admin' },
  // Diagnostics
  { key: 'diagnostics:read', name: 'View diagnostic referrals', domain: 'crm' },
  { key: 'diagnostics:write', name: 'Create diagnostic referrals', domain: 'crm' },
  // Academy
  { key: 'academy:read', name: 'View courses', domain: 'crm' },
  { key: 'academy:write', name: 'Manage courses', domain: 'crm' },
  // Supplier
  { key: 'shop:read', name: 'View shop', domain: 'crm' },
  { key: 'shop:write', name: 'Manage products / orders', domain: 'crm' },
  // Analytics
  { key: 'analytics:clinic', name: 'View clinic analytics', domain: 'finance' },
  { key: 'analytics:platform', name: 'View platform analytics', domain: 'admin' },
  // Compliance
  { key: 'compliance:view', name: 'View compliance data', domain: 'admin' },
  { key: 'compliance:manage', name: 'Manage compliance', domain: 'admin' },
];

const BASE_ROLES = [
  {
    key: 'org_admin',
    name: 'Организация — администратор',
    description: 'Full access within one organization',
    permissionKeys: [
      'patients:read', 'patients:write', 'patients:delete', 'patients:export',
      'appointments:read', 'appointments:write', 'appointments:delete',
      'medical:read', 'medical:write',
      'finance:read', 'finance:write',
      'inventory:read', 'inventory:write',
      'ai:query',
      'settings:read', 'settings:write',
      'staff:read', 'staff:write',
      'diagnostics:read', 'diagnostics:write',
      'analytics:clinic',
      'shop:read', 'shop:write',
      'compliance:view',
    ],
  },
  {
    key: 'doctor',
    name: 'Врач',
    description: 'Clinical access — patients, appointments, medical records',
    permissionKeys: [
      'patients:read', 'patients:write',
      'appointments:read', 'appointments:write',
      'medical:read', 'medical:write',
      'ai:query',
      'diagnostics:read', 'diagnostics:write',
      'analytics:clinic',
    ],
  },
  {
    key: 'nurse',
    name: 'Ассистент / Медсестра',
    description: 'Support clinical access',
    permissionKeys: [
      'patients:read', 'patients:write',
      'appointments:read', 'appointments:write',
      'inventory:read',
      'medical:read',
    ],
  },
  {
    key: 'cashier',
    name: 'Кассир / Финансы',
    description: 'Finance and billing access',
    permissionKeys: [
      'patients:read',
      'appointments:read',
      'finance:read', 'finance:write',
      'analytics:clinic',
    ],
  },
  {
    key: 'lab',
    name: 'Лаборатория',
    description: 'Lab order management',
    permissionKeys: [
      'patients:read',
      'appointments:read',
      'medical:read',
    ],
  },
  {
    key: 'lecturer',
    name: 'Лектор',
    description: 'Academy course management',
    permissionKeys: [
      'academy:read', 'academy:write',
      'settings:read',
    ],
  },
  {
    key: 'seller',
    name: 'Продавец (поставщик)',
    description: 'Shop and product management',
    permissionKeys: [
      'shop:read', 'shop:write',
      'inventory:read',
      'finance:read',
    ],
  },
  {
    key: 'superadmin',
    name: 'Суперадминистратор',
    description: 'Full platform access — all permissions',
    permissionKeys: [
      'patients:read', 'patients:write', 'patients:delete', 'patients:export',
      'appointments:read', 'appointments:write', 'appointments:delete',
      'medical:read', 'medical:write',
      'finance:read', 'finance:write', 'finance:delete',
      'inventory:read', 'inventory:write',
      'ai:query', 'ai:admin',
      'settings:read', 'settings:write',
      'staff:read', 'staff:write',
      'admin:users', 'admin:organizations', 'admin:billing', 'admin:compliance',
      'diagnostics:read', 'diagnostics:write',
      'academy:read', 'academy:write',
      'shop:read', 'shop:write',
      'analytics:clinic', 'analytics:platform',
      'compliance:view', 'compliance:manage',
    ],
  },
];

export async function seedPermissions() {
  console.log('[SEED] Seeding permissions...');

  for (const p of BASE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { name: p.name, domain: p.domain },
      create: p,
    });
  }
  console.log(`  ✓ ${BASE_PERMISSIONS.length} permissions`);

  console.log('[SEED] Seeding roles...');
  for (const r of BASE_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });

    // Link permissions
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
