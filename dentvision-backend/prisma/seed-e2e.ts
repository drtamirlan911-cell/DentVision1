/** E2E identities and deterministic fixtures. Test-only. */
import { PrismaClient, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
export const E2E_PASSWORD = 'Test1234!';
export const E2E_CLINIC_A = 'E2E Clinic A';
export const E2E_CLINIC_B = 'E2E Clinic B';

interface E2EUser {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinic: 'A' | 'B' | null;
}

export const E2E_USERS: E2EUser[] = [
  { email: 'owner-a@test.com', firstName: 'Owner', lastName: 'ClinicA', role: 'OWNER', clinic: 'A' },
  { email: 'admin-a@test.com', firstName: 'Admin', lastName: 'ClinicA', role: 'ADMIN', clinic: 'A' },
  { email: 'doctor-a@test.com', firstName: 'Doctor', lastName: 'ClinicA', role: 'DOCTOR', clinic: 'A' },
  { email: 'assistant-a@test.com', firstName: 'Assistant', lastName: 'ClinicA', role: 'ASSISTANT', clinic: 'A' },
  { email: 'manager-a@test.com', firstName: 'Manager', lastName: 'ClinicA', role: 'MANAGER', clinic: 'A' },
  { email: 'owner-b@test.com', firstName: 'Owner', lastName: 'ClinicB', role: 'OWNER', clinic: 'B' },
  { email: 'doctor-b@test.com', firstName: 'Doctor', lastName: 'ClinicB', role: 'DOCTOR', clinic: 'B' },
  { email: 'regular@test.com', firstName: 'Regular', lastName: 'User', role: 'STUDENT', clinic: null },
  { email: 'patient@dentvision.kz', firstName: 'Иван', lastName: 'Петров', role: 'PATIENT', clinic: null },
  { email: 'diagnostic-owner@test.com', firstName: 'Диагностический', lastName: 'Владелец', role: 'STUDENT', clinic: null },
  { email: 'diagnostic-operator@test.com', firstName: 'Диагностический', lastName: 'Оператор', role: 'STUDENT', clinic: null },
  { email: 'medical-lab-owner@test.com', firstName: 'Медицинская', lastName: 'Лаборатория', role: 'STUDENT', clinic: null },
  { email: 'medical-lab-tech@test.com', firstName: 'Медицинский', lastName: 'Лаборант', role: 'STUDENT', clinic: null },
  { email: 'dental-lab-owner@test.com', firstName: 'Зуботехническая', lastName: 'Лаборатория', role: 'STUDENT', clinic: null },
  { email: 'dental-technician@test.com', firstName: 'Зубной', lastName: 'Техник', role: 'STUDENT', clinic: null },
  { email: 'superadmin@test.com', firstName: 'E2E', lastName: 'Superadmin', role: 'SUPERADMIN', clinic: null },
  { email: 'support@test.com', firstName: 'E2E', lastName: 'Support', role: 'SUPPORT', clinic: null },
  { email: 'cashier-a@test.com', firstName: 'Cashier', lastName: 'ClinicA', role: 'CASHIER', clinic: 'A' },
  { email: 'lab-a@test.com', firstName: 'Lab', lastName: 'ClinicA', role: 'LAB', clinic: 'A' },
];

const E2E_PRODUCTS = [
  { name: 'E2E Oral Care Starter Kit', price: 5_900, stock: 10_000, category: 'consumables', audiences: ['GENERAL'] },
  { name: 'E2E Композит Filtek Z250', price: 18_000, stock: 10_000, category: 'materials', audiences: ['PROFESSIONAL'] },
  { name: 'E2E Боры алмазные, набор', price: 6_500, stock: 10_000, category: 'instruments', audiences: ['PROFESSIONAL'] },
  { name: 'E2E Перчатки нитриловые M', price: 4_200, stock: 10_000, category: 'consumables', audiences: ['PROFESSIONAL'] },
];

async function ensureE2ESupplier() {
  const existing = await prisma.supplier.findFirst({ where: { name: 'E2E Verified Supplier' } });
  if (existing) {
    if (existing.status !== 'verified') {
      return prisma.supplier.update({ where: { id: existing.id }, data: { status: 'verified' } });
    }
    return existing;
  }

  return prisma.supplier.create({
    data: {
      id: randomUUID(),
      name: 'E2E Verified Supplier',
      kind: 'SUPPLIER',
      status: 'verified',
      commissionRate: 800,
      isActive: true,
      email: 'e2e-supplier@test.dentvision',
      city: 'Алматы',
      description: 'Verified supplier used only by deterministic E2E fixtures',
    },
  });
}

async function upsertProducts() {
  const supplier = await ensureE2ESupplier();

  for (const p of E2E_PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    const tags = p.audiences.map((audience) => `audience:${audience}`);
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { stock: p.stock, price: p.price, supplierId: supplier.id, isActive: true, tags },
      });
      continue;
    }
    await prisma.product.create({
      data: {
        id: randomUUID(),
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        currency: 'KZT',
        description: 'Тестовая позиция каталога для сквозных сценариев',
        supplierId: supplier.id,
        isActive: true,
        tags,
      },
    });
  }
}

async function upsertAcademyFixtures() {
  const fixtures = [
    {
      title: 'E2E Professional Dentistry Course',
      audience: 'PROFESSIONAL',
      description: 'Professional-only deterministic E2E Academy fixture',
    },
    {
      title: 'E2E Patient Oral Health Course',
      audience: 'PATIENT',
      description: 'Patient-safe deterministic E2E Academy fixture',
    },
  ];

  for (const fixture of fixtures) {
    const existing = await prisma.course.findFirst({ where: { title: fixture.title } });
    if (existing) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          description: fixture.description,
          format: 'course',
          price: 0,
          meta: { audiences: [fixture.audience], tags: ['e2e'] },
        },
      });
      continue;
    }

    await prisma.course.create({
      data: {
        id: randomUUID(),
        title: fixture.title,
        description: fixture.description,
        author: 'DentVision E2E',
        price: 0,
        category: 'e2e',
        duration: '1 ч',
        format: 'course',
        meta: { audiences: [fixture.audience], tags: ['e2e'] },
      },
    });
  }
}

async function upsertClinic(name: string) {
  const existing = await prisma.clinic.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.clinic.create({ data: { id: randomUUID(), name, city: 'Алматы', plan: 'PRO', active: true } });
}

async function ensureSubscription(clinicId: string) {
  await prisma.subscription.upsert({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
    create: { ownerType: 'CLINIC', ownerId: clinicId, plan: 'enterprise', status: 'active', periodEnd: null },
    update: { plan: 'enterprise', status: 'active', periodEnd: null },
  });
}

async function ensureAiEmployeeSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_employee_tasks (
      id UUID PRIMARY KEY,
      clinic_id TEXT NOT NULL,
      user_id TEXT,
      role VARCHAR(32) NOT NULL,
      employee_title VARCHAR(120) NOT NULL,
      title VARCHAR(240) NOT NULL,
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      risk VARCHAR(16) NOT NULL DEFAULT 'low',
      autonomy VARCHAR(32) NOT NULL,
      source_event_id TEXT,
      source_event_type VARCHAR(80),
      action VARCHAR(120),
      action_payload JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      error TEXT,
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ai_employee_tasks_clinic_status_idx ON ai_employee_tasks (clinic_id, status, created_at DESC)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ai_employee_tasks_clinic_role_idx ON ai_employee_tasks (clinic_id, role, created_at DESC)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ai_employee_tasks_source_event_idx ON ai_employee_tasks (source_event_id)`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS ai_employee_tasks_event_action_role_uidx ON ai_employee_tasks (source_event_id, action, role) WHERE source_event_id IS NOT NULL AND action IS NOT NULL`);
}

async function ensureE2EPatientFixture(clinicId: string, patientUser: { id: string; email: string }) {
  const existing = await prisma.patient.findFirst({ where: { clinicId, userId: patientUser.id } });
  const patient = existing ?? await prisma.patient.create({
    data: {
      id: randomUUID(),
      clinicId,
      userId: patientUser.id,
      firstName: 'Иван',
      lastName: 'Петров',
      email: patientUser.email,
      phone: '+77001111111',
      gender: 'male',
      birthDate: new Date(1985, 5, 15),
      notes: 'Детерминированный E2E пациент DentVision',
    },
  });

  const doctor = await prisma.user.findUnique({ where: { email: 'doctor-a@test.com' }, select: { id: true } });
  if (!doctor) return patient;

  const appointmentDate = new Date();
  appointmentDate.setHours(0, 0, 0, 0);
  await prisma.appointment.upsert({
    where: {
      clinicId_patientId_date_time: {
        clinicId,
        patientId: patient.id,
        date: appointmentDate,
        time: '11:30',
      },
    },
    update: {
      doctorId: doctor.id,
      duration: 45,
      status: 'confirmed',
      type: 'Консультация',
      notes: 'E2E patient portal appointment',
    },
    create: {
      id: randomUUID(),
      clinicId,
      patientId: patient.id,
      doctorId: doctor.id,
      date: appointmentDate,
      time: '11:30',
      duration: 45,
      status: 'confirmed',
      type: 'Консультация',
      notes: 'E2E patient portal appointment',
    },
  });

  if (!await prisma.visit.findFirst({ where: { patientId: patient.id } })) {
    await prisma.visit.create({
      data: {
        id: randomUUID(),
        patientId: patient.id,
        doctorId: doctor.id,
        date: new Date(Date.now() - 7 * 86400000),
        diagnosis: 'K02.1 Кариес дентина',
        complaints: 'E2E patient portal',
        notes: 'Детерминированный визит для patient portal',
      },
    });
  }

  return patient;
}

async function ensureE2EPartnerContexts() {
  const fixtures = [
    {
      email: 'diagnostic-owner@test.com',
      scope: 'DIAGNOSTIC_CENTER' as const,
      legacyRole: 'admin',
      roleKey: 'diagnostic_owner',
      personType: 'OPERATOR',
      name: 'E2E Diagnostic Center',
      originalType: 'DiagnosticCenter',
    },
    {
      email: 'diagnostic-operator@test.com',
      scope: 'DIAGNOSTIC_CENTER' as const,
      legacyRole: 'operator',
      roleKey: 'diagnostic_operator',
      personType: 'OPERATOR',
      name: 'E2E Diagnostic Center',
      originalType: 'DiagnosticCenter',
    },
    {
      email: 'medical-lab-owner@test.com',
      scope: 'LABORATORY' as const,
      legacyRole: 'admin',
      roleKey: 'medical_lab_owner',
      personType: 'STAFF',
      name: 'E2E Medical Laboratory',
      originalType: 'Laboratory',
    },
    {
      email: 'medical-lab-tech@test.com',
      scope: 'LABORATORY' as const,
      legacyRole: 'technician',
      roleKey: 'medical_lab_technician',
      personType: 'STAFF',
      name: 'E2E Medical Laboratory',
      originalType: 'Laboratory',
    },
    {
      email: 'dental-lab-owner@test.com',
      scope: 'LABORATORY' as const,
      legacyRole: 'admin',
      roleKey: 'dental_lab_owner',
      personType: 'STAFF',
      name: 'E2E Dental Laboratory',
      originalType: 'Laboratory',
    },
    {
      email: 'dental-technician@test.com',
      scope: 'LABORATORY' as const,
      legacyRole: 'technician',
      roleKey: 'dental_technician',
      personType: 'STAFF',
      name: 'E2E Dental Laboratory',
      originalType: 'Laboratory',
    },
  ];

  const roleCache = new Map<string, { id: string }>();
  for (const fixture of fixtures) {
    let orgId: string;
    let legacyId: string;

    if (fixture.scope === 'DIAGNOSTIC_CENTER') {
      const center = await prisma.diagnosticCenter.findFirst({ where: { name: fixture.name } })
        ?? await prisma.diagnosticCenter.create({ data: { id: randomUUID(), name: fixture.name, city: 'Алматы', active: true } });
      const member = await prisma.diagnosticCenterMember.upsert({
        where: { centerId_userId: { centerId: center.id, userId: (await prisma.user.findUniqueOrThrow({ where: { email: fixture.email }, select: { id: true } })).id } },
        create: { id: randomUUID(), centerId: center.id, userId: (await prisma.user.findUniqueOrThrow({ where: { email: fixture.email }, select: { id: true } })).id, role: fixture.legacyRole },
        update: { role: fixture.legacyRole },
      });
      legacyId = member.id;
      const org = await prisma.organization.findFirst({ where: { originalType: fixture.originalType, originalId: center.id } })
        ?? await prisma.organization.create({ data: { id: randomUUID(), name: fixture.name, type: fixture.scope, originalType: fixture.originalType, originalId: center.id } });
      orgId = org.id;
    } else {
      const lab = await prisma.laboratory.findFirst({ where: { name: fixture.name } })
        ?? await prisma.laboratory.create({ data: { id: randomUUID(), name: fixture.name, city: 'Алматы', active: true } });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: fixture.email }, select: { id: true } });
      const member = await prisma.laboratoryMember.upsert({
        where: { labId_userId: { labId: lab.id, userId: user.id } },
        create: { id: randomUUID(), labId: lab.id, userId: user.id, role: fixture.legacyRole },
        update: { role: fixture.legacyRole },
      });
      legacyId = member.id;
      const org = await prisma.organization.findFirst({ where: { originalType: fixture.originalType, originalId: lab.id } })
        ?? await prisma.organization.create({ data: { id: randomUUID(), name: fixture.name, type: fixture.scope, originalType: fixture.originalType, originalId: lab.id } });
      orgId = org.id;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { email: fixture.email }, select: { id: true, firstName: true, lastName: true, email: true } });
    const person = await prisma.person.findFirst({ where: { userId: user.id, organizationId: orgId } })
      ?? await prisma.person.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          organizationId: orgId,
          fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || fixture.email,
          personType: fixture.personType,
          email: user.email,
          originalType: fixture.originalType === 'DiagnosticCenter' ? 'DiagnosticCenterMember' : 'LaboratoryMember',
          originalId: legacyId,
        },
      });

    let role = roleCache.get(fixture.roleKey);
    if (!role) {
      role = await prisma.role.upsert({
        where: { key: fixture.roleKey },
        create: { id: randomUUID(), key: fixture.roleKey, name: fixture.roleKey, description: 'E2E scoped partner role', isSystem: true },
        update: {},
        select: { id: true },
      });
      roleCache.set(fixture.roleKey, role);
    }

    await prisma.personRole.upsert({
      where: { personId_roleId: { personId: person.id, roleId: role.id } },
      create: { id: randomUUID(), personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: orgId },
      update: { scopeType: 'organization', scopeId: orgId },
    });
  }
}

async function ensureE2EBranchContext(clinicId: string, code: string, name: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM branches
    WHERE clinic_id = ${clinicId} AND code = ${code}
    LIMIT 1
  `;
  const branchId = existing[0]?.id ?? randomUUID();

  if (!existing[0]) {
    await prisma.$executeRaw`
      INSERT INTO branches
        (id, clinic_id, code, name, active, "isDefault", "createdAt", "updatedAt")
      VALUES
        (${branchId}, ${clinicId}, ${code}, ${name}, true, true, NOW(), NOW())
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE branches
      SET name = ${name}, active = true, "isDefault" = true, "updatedAt" = NOW()
      WHERE id = ${branchId}
    `;
  }

  await prisma.$executeRaw`
    UPDATE clinic_members
    SET branch_id = ${branchId}
    WHERE "clinicId" = ${clinicId} AND branch_id IS NULL
  `;

  return branchId;
}

export async function seedE2E() {
  await ensureAiEmployeeSchema();
  const password = await bcrypt.hash(E2E_PASSWORD, 10);
  const clinicA = await upsertClinic(E2E_CLINIC_A);
  const clinicB = await upsertClinic(E2E_CLINIC_B);
  await ensureSubscription(clinicA.id);
  await ensureSubscription(clinicB.id);
  await upsertProducts();
  await upsertAcademyFixtures();
  await ensureE2EPartnerContexts();

  for (const spec of E2E_USERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      create: { id: randomUUID(), email: spec.email, password, firstName: spec.firstName, lastName: spec.lastName, role: spec.role },
      update: { password, role: spec.role },
    });
    if (!spec.clinic) continue;
    const clinicId = spec.clinic === 'A' ? clinicA.id : clinicB.id;
    const member = await prisma.clinicMember.findFirst({ where: { clinicId, userId: user.id } });
    if (!member) await prisma.clinicMember.create({ data: { id: randomUUID(), clinicId, userId: user.id, role: spec.role } });
  }

  await ensureE2EBranchContext(clinicA.id, 'E2E-A-MAIN', `${E2E_CLINIC_A} — Main`);
  const patientUser = await prisma.user.findUniqueOrThrow({ where: { email: 'patient@dentvision.kz' }, select: { id: true, email: true } });
  await ensureE2EPatientFixture(clinicA.id, patientUser);
  await ensureE2EBranchContext(clinicB.id, 'E2E-B-MAIN', `${E2E_CLINIC_B} — Main`);

  return { clinicA, clinicB, users: E2E_USERS.length };
}

async function main() {
  const { clinicA, clinicB, users } = await seedE2E();
  console.log(`[SEED:E2E] ${users} users, password ${E2E_PASSWORD}`);
  console.log(`[SEED:E2E] ${E2E_CLINIC_A} = ${clinicA.id}`);
  console.log(`[SEED:E2E] ${E2E_CLINIC_B} = ${clinicB.id}`);
  console.log(`[SEED:E2E] branch context ensured for both clinics`);
  console.log(`[SEED:E2E] ${E2E_PRODUCTS.filter((p) => p.audiences.includes('PROFESSIONAL')).length} professional + 1 general product and 2 audience-scoped courses in the catalogue`);
}

main().catch((e) => { console.error('[SEED:E2E] Failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());