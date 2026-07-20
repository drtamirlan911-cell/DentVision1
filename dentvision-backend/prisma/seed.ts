import { PrismaClient } from '@prisma/client';
import { wipeApplicationData } from './lib/reset-database.js';
import {
  seedDemoEnvironment,
  TEST_USER_PASSWORD,
  TEST_USERS,
  DEMO_CLINIC,
  DEMO_PATIENTS,
} from './lib/seed-test-users.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Clean reset — test users + demo clinic + patients…');
  await wipeApplicationData(prisma);
  const { users, clinic, patients, memberCount } = await seedDemoEnvironment(prisma);

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
