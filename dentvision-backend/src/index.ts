import app from './app.js';
import { env } from './config.js';
import prisma from './lib/prisma.js';
import { eventBus } from './modules/events/index.js';
import { getEventOrchestrator } from './modules/ai/os/index.js';
import { startReminderCronInterval } from './jobs/reminderCron.js';
import { startSubscriptionCronInterval } from './jobs/subscriptionCron.js';
import { startMessageWorker } from './modules/ai-admin/index.js';

const orchestrator = getEventOrchestrator({ logLevel: 'info' });

const DB_RETRIES = 5;
const DB_RETRY_DELAY_MS = 5000;

async function connectDb(attempt = 1): Promise<void> {
  try {
    await prisma.$connect();
    console.log(`[DB] PostgreSQL connected (attempt ${attempt})`);
  } catch (err) {
    console.error(`[DB] Connection attempt ${attempt}/${DB_RETRIES} failed:`, err);
    if (attempt >= DB_RETRIES) {
      console.error('[DB] All connection attempts exhausted — exiting');
      process.exit(1);
    }
    console.log(`[DB] Retrying in ${DB_RETRY_DELAY_MS / 1000}s...`);
    await new Promise((r) => setTimeout(r, DB_RETRY_DELAY_MS));
    return connectDb(attempt + 1);
  }
}

async function main() {
  await connectDb();

  // Run schema migrations
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "Patient" ADD COLUMN IF NOT EXISTS "iin" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "iin" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "patient_iin_idx" ON "Patient"("iin")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "patients_iin_idx" ON "patients"("iin")`);
    console.log('[MIGRATION] Patient.iin column ready');
  } catch (err) {
    console.error('[MIGRATION] Patient.iin failed (non-fatal):', err);
  }

  // Diagnostic center subscriptions
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "center_subscriptions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        center_id UUID NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'trial',
        trial_end TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
        amount_monthly INT NOT NULL DEFAULT 20000,
        paid_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log('[MIGRATION] Center subscription table ready');
  } catch (err) {
    console.error('[MIGRATION] Center subscription table failed (non-fatal):', err);
  }

  // Shared product catalog — prevent duplicate listings across suppliers
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "products" ADD COLUMN IF NOT EXISTS "shared_product_id" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "products_shared_idx" ON "products"("shared_product_id")`);
    console.log('[MIGRATION] Product shared_product_id column ready');
  } catch (err) {
    console.error('[MIGRATION] Product shared_id failed (non-fatal):', err);
  }

  // School content tables
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "school_clinical_cases" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        difficulty TEXT DEFAULT 'intermediate',
        image_url TEXT,
        content JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "school_library_items" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        author TEXT,
        category TEXT,
        type TEXT DEFAULT 'article',
        url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log('[MIGRATION] School content tables ready');
  } catch (err) {
    console.error('[MIGRATION] School content tables failed (non-fatal):', err);
  }

  // Initialize Event Bus
  try {
    await eventBus.connect();
    console.log('[EVENT_BUS] Initialized');
  } catch (err) {
    console.error('[EVENT_BUS] Connection failed:', err);
    // Don't exit — fallback to in-memory mode
  }

  // Initialize Event Orchestrator (subscribes to all events)
  orchestrator.start();
  console.log('[AI_ORCHESTRATOR] Event-driven layer started');

  app.listen(env.PORT, () => {
    console.log(`[SERVER] DentVision Backend running on http://localhost:${env.PORT}`);
    console.log(`[ENV] ${env.NODE_ENV}`);
    if (env.REMINDER_CRON_MS > 0) {
      startReminderCronInterval(env.REMINDER_CRON_MS);
      startSubscriptionCronInterval(env.REMINDER_CRON_MS);
      try {
        startMessageWorker();
      } catch (err) {
        console.warn('[AI_ADMIN] Worker start failed (non-fatal):', err);
      }
    }
  });
}

process.on('SIGTERM', async () => {
  console.log('[SERVER] Shutting down...');
  orchestrator.stop();
  await eventBus.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down...');
  orchestrator.stop();
  await eventBus.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (err) => {
  console.error('[FATAL]', err);
  await prisma.$disconnect();
  process.exit(1);
});
