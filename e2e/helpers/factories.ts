// See helpers/db.ts for why this isn't the bare `@prisma/client` specifier —
// it would resolve to a dead legacy schema at the repo root, not this backend.
import { PrismaClient, UserRole, ClinicPlan, AppointmentStatus, PlanStatus, InvoiceStatus, PaymentStatus, PaymentProvider, SupplierKind, ReferralStatus } from '../../dentvision-backend/node_modules/@prisma/client/index.js'
import bcrypt from 'bcryptjs'

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

// ─── Clinic ──────────────────────────────────────────────────────────────────

export async function createTestClinic(
  opts?: Partial<{ name: string; city: string; plan: ClinicPlan }>
) {
  const name = opts?.name ?? `Test Clinic ${randomSuffix()}`
  return prisma.clinic.create({
    data: {
      name,
      city: opts?.city ?? 'Almaty',
      plan: opts?.plan ?? ClinicPlan.BASIC,
    },
  })
}

export async function createTestUser(
  opts?: Partial<{ email: string; name: string; role: UserRole; clinicId: string }>,
) {
  const user = await prisma.user.create({
    data: {
      email: opts?.email ?? uniqueEmail('user'),
      password: TEST_PASSWORD_HASH,
      name: opts?.name ?? uniqueName('Test User'),
      role: opts?.role ?? UserRole.DOCTOR,
    },
  })

  if (opts?.clinicId) {
    await prisma.clinicMember.create({
      data: { userId: user.id, clinicId: opts.clinicId, role: opts?.role ?? UserRole.DOCTOR },
    })
  }
  return user
}

export async function createTestPatient(clinicId: string, opts?: Partial<{ firstName: string; lastName: string; phone: string }>) {
  return prisma.patient.create({
    data: {
      clinicId,
      firstName: opts?.firstName ?? uniqueName('Patient'),
      lastName: opts?.lastName ?? 'Test',
      phone: opts?.phone ?? '+77000000000',
    },
  })
}

export async function createTestAppointment(clinicId: string, patientId: string, doctorId: string, opts?: Partial<{ date: Date; time: string; status: AppointmentStatus }>) {
  return prisma.appointment.create({
    data: {
      clinicId,
      patientId,
      doctorId,
      date: opts?.date ?? new Date(),
      time: opts?.time ?? '10:00',
      status: opts?.status ?? AppointmentStatus.SCHEDULED,
    },
  })
}

export { prisma }
