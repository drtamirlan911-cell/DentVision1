// See helpers/db.ts for why this isn't the bare `@prisma/client` specifier —
// it would resolve to a dead legacy schema at the repo root, not this backend.
import { PrismaClient, UserRole, ClinicPlan, AppointmentStatus, PlanStatus, InvoiceStatus, PaymentStatus, PaymentProvider, SupplierKind, ReferralStatus } from '../../dentvision-backend/node_modules/@prisma/client/index.js'
import { hashSync } from 'bcryptjs'

const prisma = new PrismaClient()

const TEST_PASSWORD_HASH = hashSync('Test1234!', 10)

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
      plan: opts?.plan ?? ClinicPlan.STANDARD,
      active: true,
    },
  })
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
  return prisma.patient.create({
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

  return user
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export async function createTestAppointment(
  clinicId: string,
  patientId: string,
  doctorId: string,
  opts?: Partial<{ date: Date; time: string; status: AppointmentStatus; duration: number }>
) {
  return prisma.appointment.create({
    data: {
      clinicId,
      patientId,
      doctorId,
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
    },
  })
}

// ─── Shop / Order / Product ─────────────────────────────────────────────────

export async function createTestProduct(
  supplierId: string,
  opts?: Partial<{ name: string; price: number; stock: number }>
) {
  const category = await prisma.shopCategory.create({
    data: {
      name: `Cat ${randomSuffix()}`,
      slug: `cat-${randomSuffix()}`,
      isActive: true,
    },
  })

  return prisma.shopProduct.create({
    data: {
      name: opts?.name ?? `Product ${randomSuffix()}`,
      price: opts?.price ?? 12000,
      stock: opts?.stock ?? 50,
      categoryId: category.id,
      supplierId,
      isActive: true,
    },
  })
}

export async function createTestOrder(
  userId: string,
  opts?: Partial<{ items: any[]; total: number; status: string }>
) {
  return prisma.order.create({
    data: {
      userId,
      items: opts?.items ?? [{ productId: 'placeholder', quantity: 2, price: 5000 }],
      total: opts?.total ?? 10000,
      status: opts?.status ?? 'PENDING',
      paymentStatus: 'PENDING',
    },
  })
}

// ─── Supplier ────────────────────────────────────────────────────────────────

export async function createTestSupplier(
  opts?: Partial<{ name: string; kind: SupplierKind }>
) {
  return prisma.supplier.create({
    data: {
      name: opts?.name ?? `Supplier ${randomSuffix()}`,
      kind: (opts?.kind as SupplierKind) ?? SupplierKind.DISTRIBUTOR,
      status: 'ACTIVE',
      isActive: true,
    },
  })
}

// ─── School Course ───────────────────────────────────────────────────────────

export async function createTestCourse(
  lecturerId: string,
  opts?: Partial<{ title: string; price: number }>
) {
  return prisma.schoolCourse.create({
    data: {
      title: opts?.title ?? `Course ${randomSuffix()}`,
      price: opts?.price ?? 50000,
      format: 'ONLINE',
      lecturerId,
    },
  })
}

// ─── Diagnostic Center & Referral ────────────────────────────────────────────

export async function createTestDiagnosticCenter(
  opts?: Partial<{ name: string; city: string }>
) {
  return prisma.diagnosticCenter.create({
    data: {
      name: opts?.name ?? `Center ${randomSuffix()}`,
      city: opts?.city ?? 'Astana',
      active: true,
    },
  })
}

export async function createTestDiagnosticReferral(
  clinicId: string,
  doctorId: string,
  centerId: string,
  opts?: Partial<{ patientName: string; category: string; status: ReferralStatus }>
) {
  const patient = await createTestPatient(clinicId, {
    firstName: opts?.patientName ?? 'Referral Patient',
  })

  return prisma.referral.create({
    data: {
      clinicId,
      patientId: patient.id,
      doctorId,
      centerId,
      category: opts?.category ?? 'DIGITAL_XRAY',
      status: (opts?.status as ReferralStatus) ?? ReferralStatus.DRAFT,
    },
  })
}

// ─── Notification ────────────────────────────────────────────────────────────

export async function createTestNotification(
  userId: string,
  opts?: Partial<{ type: string; title: string; message: string }>
) {
  return prisma.notification.create({
    data: {
      userId,
      type: opts?.type ?? 'APPOINTMENT_REMINDER',
      title: opts?.title ?? 'Upcoming Appointment',
      message: opts?.message ?? 'You have an appointment tomorrow at 10:00',
      read: false,
    },
  })
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function cleanupTestUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return

  await prisma.notification.deleteMany({ where: { userId: user.id } })
  await prisma.schoolEnrollment.deleteMany({ where: { userId: user.id } })
  await prisma.order.deleteMany({ where: { userId: user.id } })
  await prisma.clinicMember.deleteMany({ where: { userId: user.id } })
  await prisma.diagnosticCenterMember.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
}

export async function cleanupTestClinic(name: string) {
  const clinic = await prisma.clinic.findFirst({ where: { name } })
  if (!clinic) return

  await prisma.appointment.deleteMany({ where: { clinicId: clinic.id } })
  await prisma.patient.deleteMany({ where: { clinicId: clinic.id } })
  await prisma.invoice.deleteMany({ where: { clinicId: clinic.id } })
  await prisma.referral.deleteMany({ where: { clinicId: clinic.id } })
  await prisma.clinicMember.deleteMany({ where: { clinicId: clinic.id } })
  await prisma.clinic.delete({ where: { id: clinic.id } })
}

export async function cleanupAllTestData() {
  await prisma.aiMessage.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.schoolEnrollment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.referral.deleteMany()
  await prisma.diagnosticCenterMember.deleteMany()
  await prisma.diagnosticCenter.deleteMany()
  await prisma.visit.deleteMany()
  await prisma.appointment.deleteMany()
  await prisma.treatmentPlan.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.shopProduct.deleteMany()
  await prisma.shopCategory.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.schoolCourse.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.clinicMember.deleteMany()
  await prisma.clinic.deleteMany()
  await prisma.user.deleteMany()
}

// ─── Pre-built Fixtures ──────────────────────────────────────────────────────

export const CLINIC_A = {
  clinic: null as Awaited<ReturnType<typeof createTestClinic>> | null,
  owner: null as Awaited<ReturnType<typeof createTestUser>> | null,
  doctor: null as Awaited<ReturnType<typeof createTestDoctor>> | null,
  assistant: null as Awaited<ReturnType<typeof createTestAssistant>> | null,
  admin: null as Awaited<ReturnType<typeof createTestAdmin>> | null,
  cashier: null as Awaited<ReturnType<typeof createTestUser>> | null,
  lab: null as Awaited<ReturnType<typeof createTestUser>> | null,
  manager: null as Awaited<ReturnType<typeof createTestUser>> | null,
  support: null as Awaited<ReturnType<typeof createTestUser>> | null,
}

export const CLINIC_B = {
  clinic: null as Awaited<ReturnType<typeof createTestClinic>> | null,
  owner: null as Awaited<ReturnType<typeof createTestUser>> | null,
  doctor: null as Awaited<ReturnType<typeof createTestDoctor>> | null,
  assistant: null as Awaited<ReturnType<typeof createTestAssistant>> | null,
  admin: null as Awaited<ReturnType<typeof createTestAdmin>> | null,
  cashier: null as Awaited<ReturnType<typeof createTestUser>> | null,
  lab: null as Awaited<ReturnType<typeof createTestUser>> | null,
  manager: null as Awaited<ReturnType<typeof createTestUser>> | null,
  support: null as Awaited<ReturnType<typeof createTestUser>> | null,
}

function mergeClinicUsers(
  fixture: typeof CLINIC_A,
  clinic: Awaited<ReturnType<typeof createTestClinic>>,
  users: {
    owner: Awaited<ReturnType<typeof createTestUser>>
    doctor: Awaited<ReturnType<typeof createTestDoctor>>
    assistant: Awaited<ReturnType<typeof createTestAssistant>>
    admin: Awaited<ReturnType<typeof createTestAdmin>>
    cashier: Awaited<ReturnType<typeof createTestUser>>
    lab: Awaited<ReturnType<typeof createTestUser>>
    manager: Awaited<ReturnType<typeof createTestUser>>
    support: Awaited<ReturnType<typeof createTestUser>>
  }
) {
  fixture.clinic = clinic
  fixture.owner = users.owner
  fixture.doctor = users.doctor
  fixture.assistant = users.assistant
  fixture.admin = users.admin
  fixture.cashier = users.cashier
  fixture.lab = users.lab
  fixture.manager = users.manager
  fixture.support = users.support
}

async function createClinicWithAllRoles(label: string) {
  const clinic = await createTestClinic({ name: `Clinic ${label}` })

  const owner = await createTestUser({
    email: uniqueEmail(`${label}_owner`),
    firstName: `${label}Owner`,
    role: UserRole.OWNER,
  })
  await prisma.clinicMember.create({
    data: { userId: owner.id, clinicId: clinic.id, role: UserRole.OWNER },
  })

  const doctor = await createTestDoctor(clinic.id, {
    email: uniqueEmail(`${label}_doctor`),
    firstName: `${label}Doctor`,
  })

  const assistant = await createTestAssistant(clinic.id, {
    email: uniqueEmail(`${label}_assistant`),
  })

  const admin = await createTestAdmin(clinic.id, {
    email: uniqueEmail(`${label}_admin`),
  })

  const cashier = await createTestUser({
    email: uniqueEmail(`${label}_cashier`),
    firstName: `${label}Cashier`,
    role: UserRole.CASHIER,
  })
  await prisma.clinicMember.create({
    data: { userId: cashier.id, clinicId: clinic.id, role: UserRole.CASHIER },
  })

  const lab = await createTestUser({
    email: uniqueEmail(`${label}_lab`),
    firstName: `${label}Lab`,
    role: UserRole.LAB,
  })
  await prisma.clinicMember.create({
    data: { userId: lab.id, clinicId: clinic.id, role: UserRole.LAB },
  })

  const manager = await createTestUser({
    email: uniqueEmail(`${label}_manager`),
    firstName: `${label}Manager`,
    role: UserRole.MANAGER,
  })
  await prisma.clinicMember.create({
    data: { userId: manager.id, clinicId: clinic.id, role: UserRole.MANAGER },
  })

  const support = await createTestUser({
    email: uniqueEmail(`${label}_support`),
    firstName: `${label}Support`,
    role: UserRole.SUPPORT,
  })
  await prisma.clinicMember.create({
    data: { userId: support.id, clinicId: clinic.id, role: UserRole.SUPPORT },
  })

  return { clinic, owner, doctor, assistant, admin, cashier, lab, manager, support }
}

export async function setupFixtures() {
  const a = await createClinicWithAllRoles('A')
  const b = await createClinicWithAllRoles('B')
  mergeClinicUsers(CLINIC_A, a.clinic, a)
  mergeClinicUsers(CLINIC_B, b.clinic, b)
}

export async function teardownFixtures() {
  await cleanupAllTestData()
  CLINIC_A.clinic = null
  CLINIC_A.owner = null
  CLINIC_A.doctor = null
  CLINIC_A.assistant = null
  CLINIC_A.admin = null
  CLINIC_A.cashier = null
  CLINIC_A.lab = null
  CLINIC_A.manager = null
  CLINIC_A.support = null
  CLINIC_B.clinic = null
  CLINIC_B.owner = null
  CLINIC_B.doctor = null
  CLINIC_B.assistant = null
  CLINIC_B.admin = null
  CLINIC_B.cashier = null
  CLINIC_B.lab = null
  CLINIC_B.manager = null
  CLINIC_B.support = null
}
