import { PrismaClient } from '@prisma/client';
import { wipeApplicationData } from './lib/reset-database.js';
import {
  seedDemoEnvironment,
  TEST_USER_PASSWORD,
  TEST_USERS,
  DEMO_CLINIC,
  DEMO_PATIENTS,
} from './lib/seed-test-users.js';
import { DENTAL_ICD10_SEED } from '../src/modules/medical/icd10.catalog.js';

const prisma = new PrismaClient();

async function seedIcd10() {
  const count = await prisma.iCD10Code.count();
  if (count > 0) {
    console.log(`[SEED] ICD-10 already present (${count})`);
    return;
  }
  await prisma.iCD10Code.createMany({ data: DENTAL_ICD10_SEED, skipDuplicates: true });
  console.log(`[SEED] ICD-10 dental codes: ${DENTAL_ICD10_SEED.length}`);
}

async function main() {
  console.log('[SEED] Clean reset — test users + demo clinic + patients…');
  await wipeApplicationData(prisma);
  const { users, clinic, patients, memberCount } = await seedDemoEnvironment(prisma);
  await seedIcd10();

  console.log(`[SEED] Clinic: ${clinic.name} (${clinic.city}) — ${memberCount} members`);
  console.log(`[SEED] Patients: ${patients.length}`);
  console.log(`[SEED] Users: ${users.length}. Password: ${TEST_USER_PASSWORD}`);
  for (const u of TEST_USERS) {
    console.log(`  • ${u.email} (${u.role})`);
  }
  console.log('[SEED] Done.');
}

main()
  .catch((e) => {
    console.error('[SEED] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
