// See helpers/db.ts for why this isn't the bare `@prisma/client` specifier —
// it would resolve to a dead legacy schema at the repo root, not this backend.
import { PrismaClient, UserRole, ClinicPlan, AppointmentStatus, PlanStatus, InvoiceStatus, PaymentStatus, PaymentProvider, SupplierKind, ReferralStatus } from '../../dentvision-backend/node_modules/@prisma/client/index.js'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()

const TEST_PASSWORD_HASH = bcrypt.hashSync('Test1234!', 10)

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10)
}

function uniqueEmail(base: string): string {
  return `${base}_${randomSuffix()}@test.dentvision`
}

function uniqueName(base: string): string {
  return `${base} ${randomSuffix()}`
}

/**
 * Clinical tests now exercise mandatory branch scoping. Factories create an
 * isolated default branch for ad-hoc clinics and attach test members/patients
 * to it. This keeps production branch enforcement intact while making the
 * fixtures represent a valid tenant state.
 */
async function ensureTestBranch(clinicId: string): Promise<string> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "branches"
    WHERE "clinic_id" = ${clinicId} AND "active" = true
    ORDER BY "isDefault" DESC, "createdAt" ASC
    LIMIT 1
  `
  if (existing[0]?.id) return existing[0].id

  const branchId = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "branches"
      ("id", "clinic_id", "code", "name", "active", "isDefault", "createdAt", "updatedAt")
    VALUES
      (${branchId}, ${clinicId}, ${`E2E-${clinicId.slice(0, 8)}`}, 'E2E Main Branch', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  return branchId
}

// ─── Clinic ──────────────────────────────────────────────────────────────────

export async function createTestClinic(
  opts?: Partial<{ name: string; city: string; plan: ClinicPlan }>
) {
  const name = opts?.name ?? `Test Clinic ${randomSuffix()}`
  const clinic = await prisma.clinic.create({
    data: {
      name,
      city: opts?.city ?? 'Almaty',
      plan: opts?.plan ?? ClinicPlan.STANDARD,
      active: true,
    },
  })
  await ensureTestBranch(clinic.id)
  return clinic
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function createTestUser(
  opts?: Partial<{ email: string; firstName: string; lastName: string; role: UserRole; password: string }>
) {
  const email = opts?.email ?? uniqueEmail('user')
  return prisma.user.create({
    data: {
      email,
      firstName: opts?.firstName ?? 'Test',
      lastName: opts?.lastName ?? 'User',
      role: opts?.role ?? UserRole.DOCTOR,
      password: opts?.password ?? TEST_PASSWORD_HASH,
    },
  })
}

// ─── Patient ─────────────────────────────────────────────────────────────────

export async function createTestPatient(
  clinicId: string,
  opts?: Partial<{ firstName: string; lastName: string; phone: string; email: string; gender: string }>
) {
  const patient = await prisma.patient.create({
    data: {
      clinicId,
      firstName: opts?.firstName ?? 'Patient',
      lastName: opts?.lastName ?? `Last ${randomSuffix()}`,
      phone: opts?.phone ?? `+7700${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: opts?.email ?? uniqueEmail('patient'),
      birthDate: new Date('1990-05-15'),
      gender: (opts?.gender as any) ?? 'MALE',
    },
  })
  const branchId = await ensureTestBranch(clinicId)
  await prisma.$executeRaw`
    UPDATE "patients" SET "branchId" = ${branchId}
    WHERE "id" = ${patient.id} AND "clinicId" = ${clinicId}
  `
  return patient
}

// ─── Doctor (convenience) ────────────────────────────────────────────────────

export async function createTestDoctor(
  clinicId: string,
  opts?: Partial<{ email: string; firstName: string; lastName: string }>
) {
  const user = await createTestUser({
    email: opts?.email ?? uniqueEmail('doctor'),
    firstName: opts?.firstName ?? 'Doctor',
    lastName: opts?.lastName ?? `Doc ${randomSuffix()}`,
    role: UserRole.DOCTOR,
  })

  await prisma.clinicMember.create({
    data: {
      userId: user.id,
      clinicId,
      role: UserRole.DOCTOR,
    },
  })
  const branchId = await ensureTestBranch(clinicId)
  await prisma.$executeRaw`
    UPDATE "clinic_members" SET "branch_id" = ${branchId}
    WHERE "userId" = ${user.id} AND "clinicId" = ${clinicId}
  `

  return user
}

// ─── Assistant ───────────────────────────────────────────────────────────────

export async function createTestAssistant(
  clinicId: string,
  opts?: Partial<{ email: string }>
) {
  const user = await createTestUser({
    email: opts?.email ?? uniqueEmail('assistant'),
    firstName: 'Assistant',
    role: UserRole.ASSISTANT,
  })

  await prisma.clinicMember.create({
    data: {
      userId: user.id,
      clinicId,
      role: UserRole.ASSISTANT,
    },
  })
  const branchId = await ensureTestBranch(clinicId)
  await prisma.$executeRaw`
    UPDATE "clinic_members" SET "branch_id" = ${branchId}
    WHERE "userId" = ${user.id} AND "clinicId" = ${clinicId}
  `

  return user
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function createTestAdmin(
  clinicId: string,
  opts?: Partial<{ email: string }>
) {
  const user = await createTestUser({
    email: opts?.email ?? uniqueEmail('admin'),
    firstName: 'Admin',
    role: UserRole.ADMIN,
  })

  await prisma.clinicMember.create({
    data: {
      userId: user.id,
      clinicId,
      role: UserRole.ADMIN,
    },
  })
  const branchId = await ensureTestBranch(clinicId)
  await prisma.$executeRaw`
    UPDATE "clinic_members" SET "branch_id" = ${branchId}
    WHERE "userId" = ${user.id} AND "clinicId" = ${clinicId}
  `

  return user
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export async function createTestAppointment(
  clinicId: string,
  patientId: string,
  doctorId: string,
  opts?: Partial<{ date: Date; time: string; status: AppointmentStatus; duration: number }>
) {
  const patientBranch = await prisma.$queryRaw<Array<{ branchId: string | null }>>`
    SELECT "branchId" FROM "patients" WHERE "id" = ${patientId} AND "clinicId" = ${clinicId} LIMIT 1
  `
  return prisma.appointment.create({
    data: {
      clinicId,
      patientId,
      doctorId,
      branchId: patientBranch[0]?.branchId ?? undefined,
      date: opts?.date ?? new Date(),
      time: opts?.time ?? '10:00',
      duration: opts?.duration ?? 30,
      status: (opts?.status as AppointmentStatus) ?? AppointmentStatus.pending,
    },
  })
}

// ─── Visit / Diagnosis ──────────────────────────────────────────────────────

export async function createTestDiagnosis(
  patientId: string,
  doctorId: string,
  opts?: Partial<{ diagnosis: string; complaints: string }>
) {
  return prisma.visit.create({
    data: {
      patientId,
      doctorId,
      date: new Date(),
      diagnosis: opts?.diagnosis ?? 'Chronic periodontitis',
      complaints: opts?.complaints ?? 'Bleeding gums, pain when chewing',
      treatment: 'Scaling and root planing',
    },
  })
}

// ─── Treatment Plan ──────────────────────────────────────────────────────────

export async function createTestTreatmentPlan(
  patientId: string,
  opts?: Partial<{ title: string; status: PlanStatus; price: number }>
) {
  return prisma.treatmentPlan.create({
    data: {
      patientId,
      title: opts?.title ?? `Plan ${randomSuffix()}`,
      status: (opts?.status as PlanStatus) ?? PlanStatus.draft,
      price: opts?.price ?? 150000,
      items: [
        { tooth: 16, procedure: 'Crown', price: 50000 },
        { tooth: 26, procedure: 'Filling', price: 30000 },
      ],
    },
  })
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export async function createTestInvoice(
  clinicId: string,
  opts?: Partial<{ patientId: string; amount: number; status: InvoiceStatus }>
) {
  const patientId = opts?.patientId
  if (!patientId) {
    const patient = await createTestPatient(clinicId)
    opts = { ...opts, patientId: patient.id }
  }

  return prisma.invoice.create({
    data: {
      clinicId,
      patientId: opts!.patientId!,
      amount: opts?.amount ?? 75000,
      status: (opts?.status as InvoiceStatus) ?? InvoiceStatus.pending,
      paymentStatus: PaymentStatus.pending,
      paymentProvider: PaymentProvider.cash,
    },
  })
}

// ─── Diagnostic Center ───────────────────────────────────────────────────────

export async function createTestDiagnosticCenter(
  opts?: Partial<{ name: string; city: string }>
) {
  return prisma.diagnosticCenter.create({
    data: {
      name: opts?.name ?? uniqueName('Diagnostic Center'),
      city: opts?.city ?? 'Almaty',
      active: true,
    },
  })
}
