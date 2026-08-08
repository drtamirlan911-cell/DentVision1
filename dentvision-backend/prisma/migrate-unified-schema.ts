import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Canonical role key per legacy source, aligned with seed-permissions.ts and
// the unified vocabulary (domain.action) introduced in Step 4.
const CLINIC_ROLE_TO_KEY: Record<string, string> = {
  OWNER: 'owner', DIRECTOR: 'director', ADMIN: 'admin', MANAGER: 'manager',
  DOCTOR: 'doctor', ASSISTANT: 'assistant', CASHIER: 'cashier', LAB: 'lab',
  STUDENT: 'student', SUPPORT: 'support', SUPERADMIN: 'superadmin',
};

/** Resolve a ClinicMember.role (UserRole enum value) to its unified Role key, or null if unrecognized. */
export function resolveClinicRoleKey(role: string): string | null {
  return CLINIC_ROLE_TO_KEY[role] ?? null;
}

/** Ensure a Person has the given Role (by key), scoped to org or platform. */
async function assignRole(personId: string, roleKey: string, scopeType?: string, scopeId?: string) {
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) {
    console.warn(`  ⚠ role '${roleKey}' not found — skipping`);
    return;
  }
  await prisma.personRole.upsert({
    where: { personId_roleId: { personId, roleId: role.id } },
    update: {},
    create: { personId, roleId: role.id, scopeType, scopeId },
  });
}

/**
 * Per-row isolation for the backfill.
 *
 * This script runs inside render.yaml's buildCommand, chained with `&&`, and
 * main() exits non-zero on any throw — so a single unmigratable row failed the
 * whole deploy and skipped every row after it. Each row is now isolated and
 * reported; the run finishes, the deploy proceeds, and the failures are visible
 * in the build log. The script is idempotent, so anything skipped is retried on
 * the next deploy.
 */
const failures: string[] = [];

async function eachRow<T>(
  rows: T[],
  identify: (row: T) => string,
  handle: (row: T) => Promise<void>,
): Promise<number> {
  let migrated = 0;
  for (const row of rows) {
    try {
      await handle(row);
      migrated++;
    } catch (e) {
      const detail = `${identify(row)}: ${(e as Error).message}`;
      failures.push(detail);
      console.error(`  ✗ ${detail}`);
    }
  }
  return migrated;
}

async function migrateOrganizations() {
  console.log('[MIGRATE] Migrating clinics → organizations...');
  const clinics = await prisma.clinic.findMany();
  const clinicsMigrated = await eachRow(clinics, (c) => `clinic ${c.id}`, async (c) => {
      await prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Clinic', originalId: c.id } },
        update: {},
        create: {
          name: c.name,
          type: 'CLINIC',
          address: c.address || undefined,
          phone: c.phone || undefined,
          logo: c.logo || undefined,
          contacts: c.city ? { city: c.city } : undefined,
          settings: c.settings as Record<string, unknown> | undefined,
          originalType: 'Clinic',
          originalId: c.id,
        },
      });
  });
  console.log(`  ✓ ${clinicsMigrated} clinics migrated`);

  console.log('[MIGRATE] Migrating suppliers → organizations...');
  const suppliers = await prisma.supplier.findMany();
  const suppliersMigrated = await eachRow(suppliers, (s) => `supplier ${s.id}`, async (s) => {
      await prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Supplier', originalId: s.id } },
        update: {},
        create: {
          name: s.name,
          type: 'SUPPLIER_COMPANY',
          address: s.legalAddress || undefined,
          phone: s.phone || undefined,
          email: s.email || undefined,
          logo: s.logo || undefined,
          contacts: s.city ? { city: s.city, contactPerson: s.contactPerson } : undefined,
          settings: { description: s.description, kind: s.kind, commissionRate: s.commissionRate, bankDetails: s.bankDetails, deliveryConfig: s.deliveryConfig } as Record<string, unknown>,
          originalType: 'Supplier',
          originalId: s.id,
        },
      });
  });
  console.log(`  ✓ ${suppliersMigrated} suppliers migrated`);

  console.log('[MIGRATE] Migrating academies → organizations...');
  const academies = await prisma.academy.findMany();
  const academiesMigrated = await eachRow(academies, (a) => `academy ${a.id}`, async (a) => {
      await prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Academy', originalId: a.id } },
        update: {},
        create: {
          name: a.name,
          type: 'ACADEMY',
          contacts: a.city ? { city: a.city } : undefined,
          settings: { ownerId: a.ownerId } as Record<string, unknown>,
          originalType: 'Academy',
          originalId: a.id,
        },
      });
  });
  console.log(`  ✓ ${academiesMigrated} academies migrated`);

  console.log('[MIGRATE] Migrating diagnostic centers → organizations...');
  const centers = await prisma.diagnosticCenter.findMany();
  const centersMigrated = await eachRow(centers, (dc) => `diagnostic center ${dc.id}`, async (dc) => {
      await prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'DiagnosticCenter', originalId: dc.id } },
        update: {},
        create: {
          name: dc.name,
          type: 'DIAGNOSTIC_CENTER',
          address: dc.address || undefined,
          phone: dc.phone || undefined,
          email: dc.email || undefined,
          logo: dc.logo || undefined,
          contacts: dc.city ? { city: dc.city, lat: dc.lat, lng: dc.lng } : undefined,
          settings: { rating: dc.rating, accredited: dc.accredited } as Record<string, unknown>,
          originalType: 'DiagnosticCenter',
          originalId: dc.id,
        },
      });
  });
  console.log(`  ✓ ${centersMigrated} diagnostic centers migrated`);

  console.log('[MIGRATE] Migrating laboratories → organizations...');
  const labs = await prisma.laboratory.findMany();
  const labsMigrated = await eachRow(labs, (l) => `laboratory ${l.id}`, async (l) => {
      await prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Laboratory', originalId: l.id } },
        update: {},
        create: {
          name: l.name,
          type: 'LABORATORY',
          address: l.address || undefined,
          phone: l.phone || undefined,
          email: l.email || undefined,
          contacts: l.city ? { city: l.city } : undefined,
          settings: { rating: l.rating, accredited: l.accredited } as Record<string, unknown>,
          originalType: 'Laboratory',
          originalId: l.id,
        },
      });
  });
  console.log(`  ✓ ${labsMigrated} laboratories migrated`);
}

async function migratePersons() {
  console.log('[MIGRATE] Migrating clinic members → persons...');
  const members = await prisma.clinicMember.findMany({ include: { user: true } });
  const membersMigrated = await eachRow(members, (m) => `clinic member ${m.userId}@${m.clinicId}`, async (m) => {
      const org = await prisma.organization.findFirst({
        where: { originalType: 'Clinic', originalId: m.clinicId },
      });
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'ClinicMember', originalId: `${m.clinicId}:${m.userId}` } },
        update: { organizationId: org?.id ?? undefined },
        create: {
          fullName: `${m.user.firstName} ${m.user.lastName}`,
          personType: 'DOCTOR',
          organizationId: org?.id ?? undefined,
          userId: m.userId,
          specialization: m.user.spec || undefined,
          phone: m.user.phone || undefined,
          originalType: 'ClinicMember',
          originalId: `${m.clinicId}:${m.userId}`,
        },
      });
      const roleKey = resolveClinicRoleKey(m.role);
      if (!roleKey) {
        console.warn(`  ⚠ unrecognized ClinicMember role '${m.role}' for user ${m.userId} in clinic ${m.clinicId} — skipping role assignment`);
      } else {
        await assignRole(person.id, roleKey, 'organization', org?.id ?? undefined);
      }
  });
  console.log(`  ✓ ${membersMigrated} clinic members migrated to persons`);

  console.log('[MIGRATE] Migrating lecturers → persons...');
  const lecturers = await prisma.lecturer.findMany({ include: { academy: true } });
  const lecturersMigrated = await eachRow(lecturers, (l) => `lecturer ${l.id}`, async (l) => {
      const org = l.academy
        ? await prisma.organization.findFirst({ where: { originalType: 'Academy', originalId: l.academyId } })
        : null;
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'Lecturer', originalId: l.id } },
        update: { organizationId: org?.id ?? undefined },
        create: {
          fullName: `Lecturer ${l.id}`,
          personType: 'LECTURER',
          organizationId: org?.id ?? undefined,
          userId: l.userId,
          bio: l.bio || undefined,
          originalType: 'Lecturer',
          originalId: l.id,
        },
      });
      await assignRole(person.id, 'lecturer', 'organization', org?.id ?? undefined);
  });
  console.log(`  ✓ ${lecturersMigrated} lecturers migrated`);

  console.log('[MIGRATE] Migrating supplier members → persons...');
  const supplierMembers = await prisma.supplierMember.findMany({ include: { supplier: true } });
  const supplierMembersMigrated = await eachRow(supplierMembers, (sm) => `supplier member ${sm.id}`, async (sm) => {
      const org = await prisma.organization.findFirst({ where: { originalType: 'Supplier', originalId: sm.supplierId } });
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'SupplierMember', originalId: sm.id } },
        update: { organizationId: org?.id ?? undefined },
        create: {
          fullName: sm.name || `Supplier user ${sm.userId}`,
          personType: 'SUPPLIER_REP',
          organizationId: org?.id ?? undefined,
          userId: sm.userId,
          contacts: { role: sm.role } as Record<string, unknown>,
          originalType: 'SupplierMember',
          originalId: sm.id,
        },
      });
      await assignRole(person.id, 'seller', 'organization', org?.id ?? undefined);
  });
  console.log(`  ✓ ${supplierMembersMigrated} supplier members migrated`);

  console.log('[MIGRATE] Migrating diagnostic center members → persons...');
  const dcMembers = await prisma.diagnosticCenterMember.findMany({ include: { center: true } });
  const dcMembersMigrated = await eachRow(dcMembers, (dm) => `diagnostic center member ${dm.id}`, async (dm) => {
      const org = await prisma.organization.findFirst({ where: { originalType: 'DiagnosticCenter', originalId: dm.centerId } });
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'DiagnosticCenterMember', originalId: dm.id } },
        update: { organizationId: org?.id ?? undefined },
        create: {
          fullName: `DC member ${dm.userId}`,
          personType: dm.role === 'radiologist' ? 'RADIOLOGIST' : 'STAFF',
          organizationId: org?.id ?? undefined,
          userId: dm.userId,
          originalType: 'DiagnosticCenterMember',
          originalId: dm.id,
        },
      });
      await assignRole(person.id, 'doctor', 'organization', org?.id ?? undefined);
  });
  console.log(`  ✓ ${dcMembersMigrated} diagnostic center members migrated`);

  console.log('[MIGRATE] Migrating laboratory members → persons...');
  const labMembers = await prisma.laboratoryMember.findMany({ include: { lab: true } });
  const labMembersMigrated = await eachRow(labMembers, (lm) => `laboratory member ${lm.id}`, async (lm) => {
      const org = await prisma.organization.findFirst({ where: { originalType: 'Laboratory', originalId: lm.labId } });
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'LaboratoryMember', originalId: lm.id } },
        update: { organizationId: org?.id ?? undefined },
        create: {
          fullName: `Lab member ${lm.userId}`,
          personType: 'STAFF',
          organizationId: org?.id ?? undefined,
          userId: lm.userId,
          originalType: 'LaboratoryMember',
          originalId: lm.id,
        },
      });
      await assignRole(person.id, 'lab', 'organization', org?.id ?? undefined);
  });
  console.log(`  ✓ ${labMembersMigrated} laboratory members migrated`);
}

/** Give every User with role=SUPERADMIN a platform-scoped Person + PersonRole. */
async function migrateSuperAdmins() {
  console.log('[MIGRATE] Backfilling SUPERADMIN platform roles...');
  const admins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' } });
  const adminsMigrated = await eachRow(admins, (u) => `superadmin ${u.id}`, async (u) => {
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'User', originalId: u.id } },
        update: {},
        create: {
          fullName: `${u.firstName} ${u.lastName}`.trim() || 'Super Admin',
          personType: 'PLATFORM_ADMIN',
          userId: u.id,
          email: u.email || undefined,
          originalType: 'User',
          originalId: u.id,
        },
      });
      await assignRole(person.id, 'superadmin', 'platform');
  });
  console.log(`  ✓ ${adminsMigrated} superadmins backfilled`);
}

/** Give every User with role=SUPPORT a platform-scoped Person + PersonRole. */
async function migrateSupport() {
  console.log('[MIGRATE] Backfilling SUPPORT platform roles...');
  const supportUsers = await prisma.user.findMany({ where: { role: 'SUPPORT' } });
  const supportUsersMigrated = await eachRow(supportUsers, (u) => `support user ${u.id}`, async (u) => {
      const person = await prisma.person.upsert({
        where: { originalType_originalId: { originalType: 'User', originalId: u.id } },
        update: {},
        create: {
          fullName: `${u.firstName} ${u.lastName}`.trim() || 'Support',
          personType: 'PLATFORM_SUPPORT',
          userId: u.id,
          email: u.email || undefined,
          originalType: 'User',
          originalId: u.id,
        },
      });
      await assignRole(person.id, 'support', 'platform');
  });
  console.log(`  ✓ ${supportUsersMigrated} support users backfilled`);
}

async function main() {
  console.log('=== Migrate to Unified Schema (Organization + Person) ===\n');

  await migrateOrganizations();
  await migratePersons();
  await migrateSuperAdmins();
  await migrateSupport();

  if (failures.length) {
    // Loud but not fatal: this runs in the deploy's buildCommand, and refusing
    // to deploy the application because some rows could not be backfilled is
    // the worse outcome. The run is idempotent — the next deploy retries them.
    console.error(`\n=== Migration finished with ${failures.length} skipped row(s) ===`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
  } else {
    console.log('\n=== Migration complete ===');
  }
}

// Only run when executed directly (`tsx prisma/migrate-unified-schema.ts`), not
// when imported (e.g. by tests that need resolveClinicRoleKey).
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((e) => {
      console.error('[MIGRATE] Failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
