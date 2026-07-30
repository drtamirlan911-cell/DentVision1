import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function wakeDatabase() {
  console.log('Waking database...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database awake');
  } catch (e) {
    console.log('First wake attempt failed, retrying...');
    await new Promise(r => setTimeout(r, 3000));
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database awake after retry');
  }
}

async function runMigrations() {
  console.log('Running migrations...');
  try {
    execSync('prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT: '120000',
      },
    });
    console.log('Migrations completed');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await wakeDatabase();
  await runMigrations();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});