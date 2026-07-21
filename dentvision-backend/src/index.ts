import app from './app.js';
import { env } from './config.js';
import prisma from './lib/prisma.js';
import { startReminderCronInterval } from './jobs/reminderCron.js';
import { startSubscriptionCronInterval } from './jobs/subscriptionCron.js';

async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.error('[DB] Connection failed:', err);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`[SERVER] DentVision Backend running on http://localhost:${env.PORT}`);
    console.log(`[ENV] ${env.NODE_ENV}`);
    if (env.REMINDER_CRON_MS > 0) {
      startReminderCronInterval(env.REMINDER_CRON_MS);
      startSubscriptionCronInterval(env.REMINDER_CRON_MS);
    }
  });
}

process.on('SIGTERM', async () => {
  console.log('[SERVER] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (err) => {
  console.error('[FATAL]', err);
  await prisma.$disconnect();
  process.exit(1);
});
