/** E2E-only identities and catalogue fixtures. */
import { PrismaClient, type UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
export const E2E_PASSWORD = 'Test1234!';
export const E2E_CLINIC_A = 'E2E Clinic A';
export const E2E_CLINIC_B = 'E2E Clinic B';

interface E2EUser { email: string; firstName: string; lastName: string; role: UserRole; clinic: 'A' | 'B' | null; }
export const E2E_USERS: E2EUser[] = [
  { email: 'owner-a@test.com', firstName: 'Owner', lastName: 'ClinicA', role: 'OWNER', clinic: 'A' },
  { email: 'admin-a@test.com', firstName: 'Admin', lastName: 'ClinicA', role: 'ADMIN', clinic: 'A' },
  { email: 'doctor-a@test.com', firstName: 'Doctor', lastName: 'ClinicA', role: 'DOCTOR', clinic: 'A' },
  { email: 'assistant-a@test.com', firstName: 'Assistant', lastName: 'ClinicA', role: 'ASSISTANT', clinic: 'A' },
  { email: 'manager-a@test.com', firstName: 'Manager', lastName: 'ClinicA', role: 'MANAGER', clinic: 'A' },
  { email: 'owner-b@test.com', firstName: 'Owner', lastName: 'ClinicB', role: 'OWNER', clinic: 'B' },
  { email: 'doctor-b@test.com', firstName: 'Doctor', lastName: 'ClinicB', role: 'DOCTOR', clinic: 'B' },
  { email: 'regular@test.com', firstName: 'Regular', lastName: 'User', role: 'STUDENT', clinic: null },
];

const E2E_PRODUCTS = [
  { name: 'E2E Композит Filtek Z250', price: 18000, stock: 10000, category: 'materials' },
  { name: 'E2E Боры алмазные, набор', price: 6500, stock: 10000, category: 'instruments' },
  { name: 'E2E Перчатки нитриловые M', price: 4200, stock: 10000, category: 'consumables' },
];

async function upsertProducts() {
  for (const p of E2E_PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) { await prisma.product.update({ where: { id: existing.id }, data: { stock: p.stock, price: p.price } }); continue; }
    await prisma.product.create({ data: { id: randomUUID(), name: p.name, price: p.price, stock: p.stock, category: p.category, currency: 'KZT', description: 'E2E catalogue fixture' } });
  }
}

async function upsertClinic(name: string) {
  const existing = await prisma.clinic.findFirst({ where: { name } });
  return existing || prisma.clinic.create({ data: { id: randomUUID(), name, city: 'Алматы', plan: 'PRO', active: true } });
}

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
  await ensureSubscription(clinicA.id); await ensureSubscription(clinicB.id); await upsertProducts();

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
  return { clinicA, clinicB, users: E2E_USERS.length };
}

async function main() {
  const result = await seedE2E();
  console.log(`[SEED:E2E] ${result.users} users, ${E2E_PRODUCTS.length} products`);
}
main().catch((e) => { console.error('[SEED:E2E] Failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
