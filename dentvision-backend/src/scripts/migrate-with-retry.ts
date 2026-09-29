import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function wakeDatabase(maxRetries = 5, baseDelay = 3000) {
  console.error('Waking database...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.error(`Database awake (attempt ${attempt})`);
      return;
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delay = baseDelay * attempt;
      console.log(`Wake attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

async function resolveFailedMigrations() {
  console.log('Checking for failed migrations...');
  try {
    const allMigrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY finished_at DESC
    `;
    console.log('All migrations in _prisma_migrations:', JSON.stringify(allMigrations, null, 2));

    // Prisma marks a successful migration with finished_at != NULL and
    // rolled_back_at == NULL. The previous predicate inverted this meaning
    // and deleted every successful migration record, forcing migrate deploy
    // to reconsider the entire history on subsequent releases.
    const failed = allMigrations.filter(m => m.finished_at === null && m.rolled_back_at === null);
    
    if (failed.length > 0) {
      // Never mutate _prisma_migrations here. A migration with a missing
      // finished_at may have partially changed production; deleting its record
      // would hide the failure and make migrate deploy replay unknown DDL.
      throw new Error('PRISMA_MIGRATION_INCOMPLETE: ' + failed.map(r => r.migration_name).join(', '));
    } else {
      console.log('No failed migrations found');
    }
  } catch (e) {
    console.error('Error checking failed migrations:', e);
  }
}

async function runMigrations(maxRetries = 3) {
  console.log('Running migrations...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      execSync('prisma migrate deploy', {
        stdio: 'inherit',
        env: {
          ...process.env,
          PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT: '180000',
        },
        timeout: 300000,
      });
      console.log('Migrations completed');
      return;
    } catch (e) {
      console.error(`Migration attempt ${attempt} failed:`, e);
      if (attempt === maxRetries) {
        console.error('All migration attempts exhausted');
        process.exit(1);
      }
      await sleep(5000 * attempt);
    }
  }
}

async function main() {
  try {
    await wakeDatabase();
    await resolveFailedMigrations();
    await runMigrations();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});