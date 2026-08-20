/**
 * The identities the E2E suite logs in as.
 *
 * Fourteen of the sixteen specs authenticate as `owner-a@test.com` and friends,
 * and **nothing created those users**. The suite was written, committed once,
 * and never run: `npm run test:e2e` is not referenced by any CI workflow, so
 * every spec would have failed at `beforeAll` and nobody found out.
 *
 * This seed is the missing half. It is deliberately separate from
 * `seed.ts`, which wipes the database and seeds a Russian-language demo clinic
 * for people to click around in — a different job with a different audience.
 *
 * Two clinics, because a third of the assertions are about the boundary between
 * them: `tenant-isolation.spec.ts` and `idor.spec.ts` are only meaningful if
 * clinic B's data genuinely belongs to someone else.
 *
 * Idempotent throughout, so it can be re-run against a database that already
 * has it without duplicating members or failing on unique email.
 *
 * `nonexistent@test.com` is deliberately absent: four specs assert that logging
 * in as it fails. Seeding it would turn those into false passes.
 */

import { PrismaClient, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

/** Matches the literal in the specs. Test-only, and never used in any seed that could reach production. */
export const E2E_PASSWORD = 'Test1234!';

export const E2E_CLINIC_A = 'E2E Clinic A';
export const E2E_CLINIC_B = 'E2E Clinic B';

interface E2EUser {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** Which clinic they are a member of, or null for a user with no clinic at all. */
  clinic: 'A' | 'B' | null;
}

/**
 * Exactly the accounts the specs name — no more.
 *
 * `regular@test.com` has no clinic on purpose: `rbac.spec.ts` uses it to check
 * that a logged-in user with no membership is refused, which is a different
 * case from an unauthenticated one.
 */
export const E2E_USERS: E2EUser[] = [
  { email: 'owner-a@test.com', firstName: 'Owner', lastName: 'ClinicA', role: 'OWNER', clinic: 'A' },
  { email: 'admin-a@test.com', firstName: 'Admin', lastName: 'ClinicA', role: 'ADMIN', clinic: 'A' },
  { email: 'doctor-a@test.com', firstName: 'Doctor', lastName: 'ClinicA', role: 'DOCTOR', clinic: 'A' },
  { email: 'assistant-a@test.com', firstName: 'Assistant', lastName: 'ClinicA', role: 'ASSISTANT', clinic: 'A' },
  { email: 'owner-b@test.com', firstName: 'Owner', lastName: 'ClinicB', role: 'OWNER', clinic: 'B' },
  { email: 'doctor-b@test.com', firstName: 'Doctor', lastName: 'ClinicB', role: 'DOCTOR', clinic: 'B' },
  { email: 'regular@test.com', firstName: 'Regular', lastName: 'User', role: 'STUDENT', clinic: null },
];

async function upsertClinic(name: string) {
  const existing = await prisma.clinic.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.clinic.create({
    data: { id: randomUUID(), name, city: 'Алматы', plan: 'PRO', active: true },
  });
}

/**
 * A clinic on a paid plan, because `planGate` blocks writes on an expired or
 * missing subscription — and almost every spec writes something.
 */
async function ensureSubscription(clinicId: string) {
  await prisma.subscription.upsert({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
    create: { ownerType: 'CLINIC', ownerId: clinicId, plan: 'professional', status: 'active', periodEnd: null },
    update: { plan: 'professional', status: 'active', periodEnd: null },
  });
}

export async function seedE2E() {
  const password = await bcrypt.hash(E2E_PASSWORD, 10);

  const clinicA = await upsertClinic(E2E_CLINIC_A);
  const clinicB = await upsertClinic(E2E_CLINIC_B);
  await ensureSubscription(clinicA.id);
  await ensureSubscription(clinicB.id);

  for (const spec of E2E_USERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      create: {
        id: randomUUID(),
        email: spec.email,
        password,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
      },
      // Reset the password on re-run: a stale hash from an earlier convention
      // would fail every login with an error that says nothing about why.
      update: { password, role: spec.role },
    });

    if (!spec.clinic) continue;
    const clinicId = spec.clinic === 'A' ? clinicA.id : clinicB.id;
    const member = await prisma.clinicMember.findFirst({ where: { clinicId, userId: user.id } });
    if (!member) {
      await prisma.clinicMember.create({
        data: { id: randomUUID(), clinicId, userId: user.id, role: spec.role },
      });
    }
  }

  return { clinicA, clinicB, users: E2E_USERS.length };
}

async function main() {
  const { clinicA, clinicB, users } = await seedE2E();
  console.log(`[SEED:E2E] ${users} users, password ${E2E_PASSWORD}`);
  console.log(`[SEED:E2E] ${E2E_CLINIC_A} = ${clinicA.id}`);
  console.log(`[SEED:E2E] ${E2E_CLINIC_B} = ${clinicB.id}`);
}

main()
  .catch((e) => {
    console.error('[SEED:E2E] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
