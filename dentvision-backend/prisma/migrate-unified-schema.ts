import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Canonical role key per legacy source, aligned with seed-permissions.ts and
// the unified vocabulary (domain.action) introduced in Step 4.
const CLINIC_ROLE_TO_KEY: Record<string, string> = {
  OWNER: 'owner', DIRECTOR: 'director', ADMIN: 'admin', MANAGER: 'manager',
  DOCTOR: 'doctor', ASSISTANT: 'assistant', CASHIER: 'cashier', LAB: 'lab',
  STUDENT: 'student', SUPPORT: 'support',
};

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

async function migrateOrganizations() {
  console.log('[MIGRATE] Migrating clinics → organizations...');
  const clinics = await prisma.clinic.findMany();
  for (const c of clinics) {
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
  }
  console.log(`  ✓ ${clinics.length} clinics migrated`);

  console.log('[MIGRATE] Migrating suppliers → organizations...');
  const suppliers = await prisma.supplier.findMany();
  for (const s of suppliers) {
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
  }
  console.log(`  ✓ ${suppliers.length} suppliers migrated`);

  console.log('[MIGRATE] Migrating academies → organizations...');
  const academies = await prisma.academy.findMany();
  for (const a of academies) {
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
  }
  console.log(`  ✓ ${academies.length} academies migrated`);

  console.log('[MIGRATE] Migrating diagnostic centers → organizations...');
  const centers = await prisma.diagnosticCenter.findMany();
  for (const dc of centers) {
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
  }
  console.log(`  ✓ ${centers.length} diagnostic centers migrated`);

  console.log('[MIGRATE] Migrating laboratories → organizations...');
  const labs = await prisma.laboratory.findMany();
  for (const l of labs) {
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
  }
  console.log(`  ✓ ${labs.length} laboratories migrated`);
}

async function migratePersons() {
  console.log('[MIGRATE] Migrating clinic members → persons...');
  const members = await prisma.clinicMember.findMany({ include: { user: true } });
  let personCount = 0;
  for (const m of members) {
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
    const roleKey = CLINIC_ROLE_TO_KEY[m.role] || 'owner';
    await assignRole(person.id, roleKey, 'organization', org?.id ?? undefined);
    personCount++;
  }
  console.log(`  ✓ ${personCount} clinic members migrated to persons`);

  console.log('[MIGRATE] Migrating lecturers → persons...');
  const lecturers = await prisma.lecturer.findMany({ include: { academy: true } });
  let lecturerCount = 0;
  for (const l of lecturers) {
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
    lecturerCount++;
  }
  console.log(`  ✓ ${lecturerCount} lecturers migrated`);

  console.log('[MIGRATE] Migrating supplier members → persons...');
  const supplierMembers = await prisma.supplierMember.findMany({ include: { supplier: true } });
  let smCount = 0;
  for (const sm of supplierMembers) {
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
    smCount++;
  }
  console.log(`  ✓ ${smCount} supplier members migrated`);

  console.log('[MIGRATE] Migrating diagnostic center members → persons...');
  const dcMembers = await prisma.diagnosticCenterMember.findMany({ include: { center: true } });
  let dcCount = 0;
  for (const dm of dcMembers) {
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
    dcCount++;
  }
  console.log(`  ✓ ${dcCount} diagnostic center members migrated`);

  console.log('[MIGRATE] Migrating laboratory members → persons...');
  const labMembers = await prisma.laboratoryMember.findMany({ include: { lab: true } });
  let labCount = 0;
  for (const lm of labMembers) {
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
    labCount++;
  }
  console.log(`  ✓ ${labCount} laboratory members migrated`);
}

/** Give every User with role=SUPERADMIN a platform-scoped Person + PersonRole. */
async function migrateSuperAdmins() {
  console.log('[MIGRATE] Backfilling SUPERADMIN platform roles...');
  const admins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' } });
  let count = 0;
  for (const u of admins) {
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
    count++;
  }
  console.log(`  ✓ ${count} superadmins backfilled`);
}

async function main() {
  console.log('=== Migrate to Unified Schema (Organization + Person) ===\n');

  await migrateOrganizations();
  await migratePersons();
  await migrateSuperAdmins();

  console.log('\n=== Migration complete ===');
}

main()
  .catch((e) => {
    console.error('[MIGRATE] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
