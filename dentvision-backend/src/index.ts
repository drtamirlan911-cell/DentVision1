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

  // Seed marketplace catalog
  try {
    const catCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(`SELECT COUNT(*)::int as cnt FROM "shop_categories"`);
    if (catCount[0].cnt === 0) {
      const categories = [
        { name: 'Композиты', slug: 'composites', description: 'Пломбировочные материалы', sortOrder: 1 },
        { name: 'Инструменты', slug: 'instruments', description: 'Стоматологические инструменты', sortOrder: 2 },
        { name: 'Оборудование', slug: 'equipment', description: 'Стоматологическое оборудование', sortOrder: 3 },
        { name: 'Анестетики', slug: 'anesthetics', description: 'Местная анестезия', sortOrder: 4 },
        { name: 'Расходные материалы', slug: 'consumables', description: 'Перчатки, маски, салфетки', sortOrder: 5 },
        { name: 'Имплантаты', slug: 'implants', description: 'Имплантаты и компоненты', sortOrder: 6 },
        { name: 'Ортодонтия', slug: 'orthodontics', description: 'Брекеты, дуги, эластики', sortOrder: 7 },
        { name: 'Эндодонтия', slug: 'endodontics', description: 'Файлы, гуттаперча, силеры', sortOrder: 8 },
      ];
      for (const c of categories) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "shop_categories" (id, name, slug, description, sort_order) VALUES (gen_random_uuid(), $1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          c.name, c.slug, c.description, c.sortOrder
        );
      }
      console.log('[SEED] 8 shop categories created');
    }
  } catch (err) {
    console.warn('[SEED] Categories seed failed (non-fatal):', err);
  }

  // Seed sample products for DentVision supplier
  try {
    const prodCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(`SELECT COUNT(*)::int as cnt FROM "products"`);
    if (prodCount[0].cnt === 0) {
      const dvSupplier = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "suppliers" WHERE name = 'DentVision' LIMIT 1`);
      if (dvSupplier.length > 0) {
        const sid = dvSupplier[0].id;
        const compositesId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'composites' LIMIT 1`))[0]?.id;
        const products = [
          { name: 'Filtek Z350 XT', brand: '3M ESPE', category: 'Композиты', categoryId: compositesId, price: 8500, description: 'Универсальный наногибридный композит', stock: 50, unit: 'шприц', weight: 0.05 },
          { name: 'Filtek Ultimate', brand: '3M ESPE', category: 'Композиты', categoryId: compositesId, price: 12000, description: 'Композит для фронтальной и жевательной групп', stock: 30, unit: 'шприц', weight: 0.05 },
          { name: 'Charisma Diamond', brand: 'Kulzer', category: 'Композиты', categoryId: compositesId, price: 7800, description: 'Наногибридный композит', stock: 40, unit: 'шприц', weight: 0.05 },
          { name: 'Убестезин форте', brand: '3M ESPE', category: 'Анестетики', categoryId: null, price: 1200, description: 'Артикаин 4% с эпинефрином', stock: 200, unit: 'карпула', weight: 0.01 },
          { name: 'Скалер ультразвуковой', brand: 'Woodpecker', category: 'Оборудование', categoryId: null, price: 45000, description: 'Ультразвуковой скалер для снятия зубных отложений', stock: 5, unit: 'шт', weight: 1.5 },
          { name: 'K-File NiTi 25мм #15-40', brand: 'Mani', category: 'Эндодонтия', categoryId: null, price: 3500, description: 'Набор ручных эндодонтических файлов', stock: 30, unit: 'набор', weight: 0.02 },
          { name: 'NeoBiotech Implant', brand: 'NeoBiotech', category: 'Имплантаты', categoryId: null, price: 65000, description: 'Система имплантатов NeoBiotech', stock: 10, unit: 'шт', weight: 0.03 },
          { name: 'Ортодонтические брекеты', brand: 'ORMCO', category: 'Ортодонтия', categoryId: null, price: 28000, description: 'Металлические брекеты Damon Q', stock: 15, unit: 'набор', weight: 0.1 },
          { name: 'Перчатки нитриловые (M)', brand: 'Unigloves', category: 'Расходные материалы', categoryId: null, price: 350, description: 'Нитриловые смотровые перчатки, размер M', stock: 500, unit: 'пара', weight: 0.005 },
          { name: 'Гуттаперча ProTaper', brand: 'Dentsply', category: 'Эндодонтия', categoryId: null, price: 900, description: 'Гуттаперчевые штифты ProTaper', stock: 100, unit: 'шт', weight: 0.001 },
        ];
        for (const p of products) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "products" (id, name, brand, category, category_id, price, description, stock, unit, weight, supplier_id, is_active) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT DO NOTHING`,
            p.name, p.brand, p.category, p.categoryId, p.price, p.description, p.stock, p.unit, p.weight, sid
          );
        }
        console.log(`[SEED] ${products.length} products created for DentVision supplier`);
      }
    }
  } catch (err) {
    console.warn('[SEED] Products seed failed (non-fatal):', err);
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
