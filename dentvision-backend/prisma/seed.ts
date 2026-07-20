import { PrismaClient } from '@prisma/client';
import { wipeApplicationData } from './lib/reset-database.js';
import { seedTestUsersOnly, TEST_USER_PASSWORD, TEST_USERS } from './lib/seed-test-users.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Clean reset — test users only (no clinics, no patients)…');
  await wipeApplicationData(prisma);
  const users = await seedTestUsersOnly(prisma);

  console.log(`[SEED] Created ${users.length} test users. Password for all: ${TEST_USER_PASSWORD}`);
  for (const u of TEST_USERS) {
    console.log(`  • ${u.email} (${u.role})`);
  }
  console.log('[SEED] Done. Users register/create clinics via the app.');
}

main()
  .catch((e) => {
    console.error('[SEED] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
