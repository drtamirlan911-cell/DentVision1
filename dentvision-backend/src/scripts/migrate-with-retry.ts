import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function wakeDatabase(maxRetries = 5, baseDelay = 3000) {
  console.log('Waking database...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`Database awake (attempt ${attempt})`);
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
    const result = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" 
      WHERE finished_at IS NOT NULL AND success = false
      ORDER BY finished_at DESC
    `;
    
    if (result.length > 0) {
      console.log(`Found ${result.length} failed migration(s):`, result.map(r => r.migration_name));
      for (const m of result) {
        console.log(`Resolving failed migration: ${m.migration_name}`);
        try {
          execSync(`prisma migrate resolve --rolled-back "${m.migration_name}"`, {
            stdio: 'inherit',
            env: process.env,
          });
          console.log(`Resolved: ${m.migration_name}`);
        } catch (e) {
          console.error(`Failed to resolve ${m.migration_name}:`, e);
        }
      }
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