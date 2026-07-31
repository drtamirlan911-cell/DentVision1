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
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "iin" TEXT`);
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

  // Ensure marketplace tables exist (init_full_schema migration may have failed)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_categories" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        icon TEXT,
        image_url TEXT,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        parent_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "products" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        brand TEXT,
        category TEXT,
        category_id UUID,
        price INT NOT NULL DEFAULT 0,
        old_price INT,
        stock INT DEFAULT 0,
        min_stock INT DEFAULT 0,
        description TEXT,
        image_url TEXT,
        images JSONB,
        rating DOUBLE PRECISION DEFAULT 4.5,
        review_count INT DEFAULT 0,
        supplier_id UUID,
        own_brand BOOLEAN DEFAULT false,
        sku TEXT,
        unit TEXT,
        currency TEXT DEFAULT 'KZT',
        tags JSONB,
        specs JSONB,
        weight DOUBLE PRECISION,
        manufacturer TEXT,
        country TEXT,
        is_active BOOLEAN DEFAULT true,
        compatibility TEXT,
        seo_title TEXT,
        seo_description TEXT,
        video_url TEXT,
        model3d_url TEXT,
        expiry_date TIMESTAMPTZ,
        shared_product_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        kind TEXT DEFAULT 'SUPPLIER',
        status TEXT DEFAULT 'pending',
        email TEXT,
        phone TEXT,
        city TEXT,
        legal_address TEXT,
        description TEXT,
        logo TEXT,
        rating DOUBLE PRECISION DEFAULT 0,
        review_count INT DEFAULT 0,
        order_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        commission_rate INT DEFAULT 500,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "delivery_zones" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id UUID NOT NULL,
        name TEXT NOT NULL,
        cities JSONB DEFAULT '[]',
        cost INT DEFAULT 0,
        free_from INT,
        estimated_days INT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "orders" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID,
        user_id UUID NOT NULL,
        items JSONB DEFAULT '[]',
        status TEXT DEFAULT 'pending',
        total INT DEFAULT 0,
        meta JSONB,
        delivery_address TEXT,
        delivery_method TEXT,
        delivery_cost INT DEFAULT 0,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        recipient_name TEXT,
        recipient_phone TEXT,
        supplier_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "favorites" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        product_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, product_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "shop_reviews" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL,
        user_id UUID NOT NULL,
        rating INT NOT NULL DEFAULT 5,
        pros TEXT,
        cons TEXT,
        comment TEXT,
        images JSONB,
        is_approved BOOLEAN DEFAULT true,
        helpful_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    // IAM / organization / person tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "supplier_members" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        supplier_id UUID NOT NULL,
        role TEXT DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'CLINIC',
        original_type TEXT,
        original_id UUID,
        logo TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        contacts JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ,
        UNIQUE(original_type, original_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "persons" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        organization_id UUID NOT NULL,
        person_type TEXT NOT NULL DEFAULT 'STAFF',
        full_name TEXT,
        specialization TEXT,
        phone TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "payments" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT DEFAULT 'kaspi_qr',
        external_id TEXT,
        amount BIGINT NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'KZT',
        status TEXT DEFAULT 'pending',
        ref_type TEXT,
        ref_id UUID,
        domain TEXT,
        seller_type TEXT,
        seller_id UUID,
        meta JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "wallets" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_type TEXT NOT NULL,
        owner_id UUID NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KZT',
        balance BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ,
        UNIQUE(owner_type, owner_id, currency)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT DEFAULT 'sale',
        status TEXT DEFAULT 'pending',
        amount BIGINT NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'KZT',
        ref_type TEXT,
        ref_id UUID,
        meta JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ledger_entries" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID,
        wallet_id UUID,
        direction TEXT NOT NULL DEFAULT 'credit',
        amount BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "commission_rules" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT NOT NULL,
        scope_id UUID,
        percent_bps INT NOT NULL DEFAULT 1000,
        split_json JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ,
        UNIQUE(domain, scope_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_type TEXT NOT NULL,
        owner_id UUID NOT NULL,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ,
        UNIQUE(owner_type, owner_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        token_hash TEXT,
        expired_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log('[MIGRATION] Marketplace + IAM + Finance tables ready');
  } catch (err) {
    console.error('[MIGRATION] Marketplace tables failed (non-fatal):', err);
  }

  // Seed marketplace catalog
  try {
    // Ensure DentVision supplier exists
    const supCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(`SELECT COUNT(*)::int as cnt FROM "suppliers"`);
    if (supCount[0].cnt === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "suppliers" (id, name, kind, status, email, phone, city, "legalAddress", description, rating, "commissionRate", "isActive") VALUES (gen_random_uuid(), 'DentVision', 'DISTRIBUTOR', 'official_partner', 'supplier@dentvision.kz', '+7 727 123 45 67', 'Алматы', 'ул. Абая 150, офис 301', 'Официальный поставщик стоматологических материалов и оборудования DentVision', 4.8, 500, true) ON CONFLICT DO NOTHING`
      );
      console.log('[SEED] DentVision supplier created');
    }

    const catCount = await prisma.$queryRawUnsafe<Array<{ cnt: number }>>(`SELECT COUNT(*)::int as cnt FROM "shop_categories"`);
    if (catCount[0].cnt === 0) {
      const categories = [
        { name: 'Композиты', slug: 'composites', description: 'Пломбировочные и реставрационные материалы', sortOrder: 1 },
        { name: 'Инструменты', slug: 'instruments', description: 'Стоматологические инструменты и наконечники', sortOrder: 2 },
        { name: 'Оборудование', slug: 'equipment', description: 'Стоматологические установки, автоклавы, скалеры', sortOrder: 3 },
        { name: 'Анестетики', slug: 'anesthetics', description: 'Местная анестезия и карпулы', sortOrder: 4 },
        { name: 'Расходные материалы', slug: 'consumables', description: 'Перчатки, маски, салфетки, шприцы', sortOrder: 5 },
        { name: 'Имплантаты', slug: 'implants', description: 'Системы имплантатов и компоненты', sortOrder: 6 },
        { name: 'Ортодонтия', slug: 'orthodontics', description: 'Брекеты, дуги, эластики, лигатуры', sortOrder: 7 },
        { name: 'Эндодонтия', slug: 'endodontics', description: 'Файлы, гуттаперча, силеры, обтураторы', sortOrder: 8 },
        { name: 'Ортопедия', slug: 'prosthetics', description: 'Коронки, мосты, съёмные протезы, слепочные массы', sortOrder: 9 },
        { name: 'Профилактика', slug: 'prevention', description: 'Пасты, щётки, ополаскиватели, герметики', sortOrder: 10 },
        { name: 'Хирургия', slug: 'surgery', description: 'Хирургические инструменты, шовный материал', sortOrder: 11 },
        { name: 'Диагностика', slug: 'diagnostics_supplies', description: 'Рентген-плёнка, датчики, визиографы', sortOrder: 12 },
      ];
      for (const c of categories) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "shop_categories" (id, name, slug, description, "sortOrder") VALUES (gen_random_uuid(), $1,$2,$3,$4) ON CONFLICT DO NOTHING`,
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
        const instrumentsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'instruments' LIMIT 1`))[0]?.id;
        const equipmentId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'equipment' LIMIT 1`))[0]?.id;
        const anestheticsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'anesthetics' LIMIT 1`))[0]?.id;
        const consumablesId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'consumables' LIMIT 1`))[0]?.id;
        const implantsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'implants' LIMIT 1`))[0]?.id;
        const orthodonticsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'orthodontics' LIMIT 1`))[0]?.id;
        const endodonticsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'endodontics' LIMIT 1`))[0]?.id;
        const prostheticsId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'prosthetics' LIMIT 1`))[0]?.id;
        const preventionId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'prevention' LIMIT 1`))[0]?.id;
        const surgeryId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'surgery' LIMIT 1`))[0]?.id;
        const diagId = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "shop_categories" WHERE slug = 'diagnostics_supplies' LIMIT 1`))[0]?.id;

        // Generate inline SVG images per category — no external URLs needed
        const catColors: Record<string, string> = {
          'Композиты': '6C63FF', 'Инструменты': '00B4D8', 'Оборудование': '0077B6',
          'Анестетики': 'E63946', 'Расходные материалы': '2A9D8F', 'Имплантаты': 'F4A261',
          'Ортодонтия': 'E9C46A', 'Эндодонтия': '264653', 'Ортопедия': '9C89B8',
          'Профилактика': '43AA8B', 'Хирургия': 'BC4749',
        };
        const catIcons: Record<string, string> = {
          'Композиты': '◇', 'Инструменты': '🔧', 'Оборудование': '⚙️',
          'Анестетики': '💉', 'Расходные материалы': '🧤', 'Имплантаты': '⚡',
          'Ортодонтия': '😁', 'Эндодонтия': '🦷', 'Ортопедия': '👑',
          'Профилактика': '🪥', 'Хирургия': '🏥',
        };
        const svgImg = (label: string, cat: string) => {
          const color = catColors[cat] || 'C9A96E';
          const icon = catIcons[cat] || '📦';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#0D1B2E" rx="16"/>
  <rect width="400" height="400" fill="#${color}" opacity="0.12" rx="16"/>
  <circle cx="200" cy="140" r="60" fill="#${color}" opacity="0.2"/>
  <text x="200" y="160" text-anchor="middle" font-size="48">${icon}</text>
  <text x="200" y="250" text-anchor="middle" font-size="14" fill="#7A8899" font-family="Arial">${cat}</text>
  <text x="200" y="280" text-anchor="middle" font-size="16" fill="#C9A96E" font-family="Arial" font-weight="bold">${label.length > 22 ? label.slice(0, 22) + '…' : label}</text>
  <rect x="50" y="320" width="300" height="2" fill="#${color}" opacity="0.3" rx="1"/>
  <text x="200" y="355" text-anchor="middle" font-size="12" fill="#4A5568" font-family="Arial">DentVision Marketplace</text>
</svg>`;
          return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
        };
        const products = [
          // Композиты
          { name: 'Filtek Z350 XT', brand: '3M ESPE', cat: 'Композиты', catId: compositesId, price: 8500, desc: 'Универсальный наногибридный композит', stock: 50, unit: 'шприц', img: svgImg('Filtek Z350 XT', 'Композиты') },
          { name: 'Filtek Ultimate', brand: '3M ESPE', cat: 'Композиты', catId: compositesId, price: 12000, desc: 'Композит для фронтальной и жевательной групп', stock: 30, unit: 'шприц', img: svgImg('Filtek Ultimate', 'Композиты') },
          { name: 'Charisma Diamond', brand: 'Kulzer', cat: 'Композиты', catId: compositesId, price: 7800, desc: 'Наногибридный композит с высокой эстетикой', stock: 40, unit: 'шприц', img: svgImg('Charisma Diamond', 'Композиты') },
          { name: 'Estelite Sigma Quick', brand: 'Tokuyama', cat: 'Композиты', catId: compositesId, price: 9500, desc: 'Светоотверждаемый композит', stock: 25, unit: 'шприц', img: svgImg('Estelite Sigma Quick', 'Композиты') },
          { name: 'Estelite Asteria', brand: 'Tokuyama', cat: 'Композиты', catId: compositesId, price: 13500, desc: 'Супра-нано композит с эффектом хамелеона', stock: 20, unit: 'шприц', img: svgImg('Estelite Asteria', 'Композиты') },
          { name: 'SDR Flow+', brand: 'Dentsply', cat: 'Композиты', catId: compositesId, price: 6200, desc: 'Текучий композит для объёмного пломбирования', stock: 35, unit: 'шприц', img: svgImg('SDR Flow+', 'Композиты') },
          // Инструменты
          { name: 'Турбинный наконечник', brand: 'NSK', cat: 'Инструменты', catId: instrumentsId, price: 45000, desc: 'Скоростной турбинный наконечник Pana-Max', stock: 8, unit: 'шт', img: svgImg('Турбинный наконечник NSK', 'Инструменты') },
          { name: 'Угловой наконечник', brand: 'Kavo', cat: 'Инструменты', catId: instrumentsId, price: 38000, desc: 'Микромоторный угловой наконечник', stock: 6, unit: 'шт', img: svgImg('Угловой наконечник Kavo', 'Инструменты') },
          { name: 'Алмазные боры (набор)', brand: 'Mani', cat: 'Инструменты', catId: instrumentsId, price: 4500, desc: 'Набор алмазных боров 10 шт', stock: 60, unit: 'набор', img: svgImg('Алмазные боры', 'Инструменты') },
          { name: 'Элеватор хирургический', brand: 'Hu-Friedy', cat: 'Инструменты', catId: instrumentsId, price: 2200, desc: 'Прямой элеватор для удаления', stock: 25, unit: 'шт', img: svgImg('Элеватор хирургический', 'Инструменты') },
          { name: 'Зеркало стоматологическое', brand: 'Hu-Friedy', cat: 'Инструменты', catId: instrumentsId, price: 800, desc: 'Смотровое зеркало #5', stock: 100, unit: 'шт', img: svgImg('Зеркало стоматологическое', 'Инструменты') },
          { name: 'Пинцет стоматологический', brand: 'Hu-Friedy', cat: 'Инструменты', catId: instrumentsId, price: 650, desc: 'Анатомический пинцет', stock: 80, unit: 'шт', img: svgImg('Пинцет стоматологический', 'Инструменты') },
          // Оборудование
          { name: 'Стоматологическая установка', brand: 'Sirona', cat: 'Оборудование', catId: equipmentId, price: 2500000, desc: 'Установка Intego Pro, полная комплектация', stock: 2, unit: 'шт', img: svgImg('Установка Sirona Intego', 'Оборудование') },
          { name: 'Скалер ультразвуковой', brand: 'Woodpecker', cat: 'Оборудование', catId: equipmentId, price: 45000, desc: 'Ультразвуковой скалер UDS-L', stock: 5, unit: 'шт', img: svgImg('Скалер Woodpecker', 'Оборудование') },
          { name: 'Автоклав', brand: 'Melag', cat: 'Оборудование', catId: equipmentId, price: 180000, desc: 'Автоклав Melag 23B+', stock: 3, unit: 'шт', img: svgImg('Автоклав Melag 23B+', 'Оборудование') },
          { name: 'Фотополимерная лампа', brand: 'Woodpecker', cat: 'Оборудование', catId: equipmentId, price: 15000, desc: 'LED-лампа для фотополимеризации', stock: 15, unit: 'шт', img: svgImg('LED-лампа Woodpecker', 'Оборудование') },
          { name: 'Апекслокатор', brand: 'Woodpecker', cat: 'Оборудование', catId: equipmentId, price: 22000, desc: 'Электронный апекслокатор Woodpex V', stock: 10, unit: 'шт', img: svgImg('Апекслокатор Woodpex V', 'Оборудование') },
          { name: 'Визиограф', brand: 'Sirona', cat: 'Оборудование', catId: equipmentId, price: 320000, desc: 'Внутриротовой рентген-датчик', stock: 2, unit: 'шт', img: svgImg('Визиограф Sirona', 'Оборудование') },
          // Анестетики
          { name: 'Убестезин форте', brand: '3M ESPE', cat: 'Анестетики', catId: anestheticsId, price: 1100, desc: 'Артикаин 4% + эпинефрин 1:100000', stock: 200, unit: 'карпула', img: svgImg('Убестезин форте', 'Анестетики') },
          { name: 'Ultracain D-S', brand: 'Sanofi', cat: 'Анестетики', catId: anestheticsId, price: 950, desc: 'Артикаин 4% + эпинефрин 1:200000', stock: 180, unit: 'карпула', img: svgImg('Ultracain D-S', 'Анестетики') },
          { name: 'Мепивакаин 3% без эпинефрина', brand: 'Septodont', cat: 'Анестетики', catId: anestheticsId, price: 850, desc: 'Скандонест 3% (мепивакаин) без вазоконстриктора, карпула 1.8 мл', stock: 150, unit: 'карпула', img: svgImg('Мепивакаин 3%', 'Анестетики') },
          { name: 'Лидокаин 2%', brand: 'Биосинтез', cat: 'Анестетики', catId: anestheticsId, price: 400, desc: 'Лидокаин гидрохлорид 2%', stock: 300, unit: 'ампула', img: svgImg('Лидокаин 2%', 'Анестетики') },
          // Расходные материалы
          { name: 'Перчатки нитриловые (M)', brand: 'Unigloves', cat: 'Расходные материалы', catId: consumablesId, price: 350, desc: 'Нитриловые смотровые перчатки, размер M', stock: 500, unit: 'пара', img: svgImg('Перчатки нитриловые M', 'Расходные материалы') },
          { name: 'Перчатки нитриловые (S)', brand: 'Unigloves', cat: 'Расходные материалы', catId: consumablesId, price: 350, desc: 'Нитриловые смотровые перчатки, размер S', stock: 400, unit: 'пара', img: svgImg('Перчатки нитриловые S', 'Расходные материалы') },
          { name: 'Маска медицинская 3-слойная', brand: 'Medicom', cat: 'Расходные материалы', catId: consumablesId, price: 80, desc: 'Одноразовая медицинская маска', stock: 1000, unit: 'шт', img: svgImg('Маска медицинская', 'Расходные материалы') },
          { name: 'Слюноотсос одноразовый', brand: 'Medicom', cat: 'Расходные материалы', catId: consumablesId, price: 120, desc: 'Одноразовый слюноотсос', stock: 600, unit: 'шт', img: svgImg('Слюноотсос одноразовый', 'Расходные материалы') },
          { name: 'Шприцы инъекционные 27G', brand: 'B.Braun', cat: 'Расходные материалы', catId: consumablesId, price: 45, desc: 'Инъекционные шприцы 2 мл, игла 27G', stock: 800, unit: 'шт', img: svgImg('Шприцы 27G', 'Расходные материалы') },
          { name: 'Ватные валики', brand: 'Scotch', cat: 'Расходные материалы', catId: consumablesId, price: 180, desc: 'Ватные валики для изоляции, 100 шт', stock: 300, unit: 'упак', img: svgImg('Ватные валики', 'Расходные материалы') },
          // Имплантаты
          { name: 'NeoBiotech IS-II', brand: 'NeoBiotech', cat: 'Имплантаты', catId: implantsId, price: 65000, desc: 'Система имплантатов IS-II Active', stock: 10, unit: 'шт', img: svgImg('NeoBiotech IS-II', 'Имплантаты') },
          { name: 'Osstem TSIII', brand: 'Osstem', cat: 'Имплантаты', catId: implantsId, price: 55000, desc: 'Имплантат TSIII SA 4.0x10мм', stock: 15, unit: 'шт', img: svgImg('Osstem TSIII', 'Имплантаты') },
          { name: 'Alpha-Bio Tec', brand: 'Alpha-Bio', cat: 'Имплантаты', catId: implantsId, price: 48000, desc: 'Имплантат SPI 3.75x11.5мм', stock: 12, unit: 'шт', img: svgImg('Alpha-Bio Tec', 'Имплантаты') },
          { name: 'Nobel Biocare', brand: 'Nobel', cat: 'Имплантаты', catId: implantsId, price: 85000, desc: 'Имплантат NobelActive 4.3x10мм', stock: 8, unit: 'шт', img: svgImg('Nobel Biocare', 'Имплантаты') },
          { name: 'Формирователь десны', brand: 'Osstem', cat: 'Имплантаты', catId: implantsId, price: 3500, desc: 'Формирователь десны Ø5.0, h=3.0', stock: 40, unit: 'шт', img: svgImg('Формирователь десны', 'Имплантаты') },
          // Ортодонтия
          { name: 'Брекеты Damon Q', brand: 'ORMCO', cat: 'Ортодонтия', catId: orthodonticsId, price: 28000, desc: 'Металлические самолигирующие брекеты', stock: 15, unit: 'набор', img: svgImg('Брекеты Damon Q', 'Ортодонтия') },
          { name: 'Брекеты Damon Clear', brand: 'ORMCO', cat: 'Ортодонтия', catId: orthodonticsId, price: 38000, desc: 'Эстетические самолигирующие брекеты', stock: 10, unit: 'набор', img: svgImg('Брекеты Damon Clear', 'Ортодонтия') },
          { name: 'Дуга NiTi 0.014', brand: '3M Unitek', cat: 'Ортодонтия', catId: orthodonticsId, price: 450, desc: 'Нитиноловая дуга верхняя', stock: 100, unit: 'шт', img: svgImg('Дуга NiTi 0.014', 'Ортодонтия') },
          { name: 'Дуга SS 0.019×0.025', brand: '3M Unitek', cat: 'Ортодонтия', catId: orthodonticsId, price: 380, desc: 'Стальная дуга нижняя', stock: 80, unit: 'шт', img: svgImg('Дуга SS .019×.025', 'Ортодонтия') },
          { name: 'Эластики ортодонтические', brand: 'ORMCO', cat: 'Ортодонтия', catId: orthodonticsId, price: 650, desc: 'Межчелюстные эластики 3/16" Heavy', stock: 200, unit: 'упак', img: svgImg('Эластики ортодонтические', 'Ортодонтия') },
          // Эндодонтия
          { name: 'K-File NiTi 25мм #15-40', brand: 'Mani', cat: 'Эндодонтия', catId: endodonticsId, price: 3500, desc: 'Набор ручных эндодонтических файлов', stock: 30, unit: 'набор', img: svgImg('K-File NiTi #15-40', 'Эндодонтия') },
          { name: 'Гуттаперча ProTaper F2', brand: 'Dentsply', cat: 'Эндодонтия', catId: endodonticsId, price: 900, desc: 'Гуттаперчевые штифты ProTaper', stock: 100, unit: 'упак', img: svgImg('Гуттаперча ProTaper F2', 'Эндодонтия') },
          { name: 'AH Plus силер', brand: 'Dentsply', cat: 'Эндодонтия', catId: endodonticsId, price: 5500, desc: 'Эпоксидный силер для корневых каналов', stock: 40, unit: 'набор', img: svgImg('AH Plus силер', 'Эндодонтия') },
          { name: 'ProTaper Gold F1-F5', brand: 'Dentsply', cat: 'Эндодонтия', catId: endodonticsId, price: 8500, desc: 'Роторные файлы ProTaper Gold', stock: 20, unit: 'набор', img: svgImg('ProTaper Gold', 'Эндодонтия') },
          { name: 'ЭДТА-гель 15%', brand: 'Septodont', cat: 'Эндодонтия', catId: endodonticsId, price: 1200, desc: 'Гель для расширения каналов', stock: 60, unit: 'шприц', img: svgImg('ЭДТА-гель 15%', 'Эндодонтия') },
          // Ортопедия
          { name: 'Силиконовый оттискной материал', brand: '3M ESPE', cat: 'Ортопедия', catId: prostheticsId, price: 4500, desc: 'A-силикон для точных оттисков', stock: 25, unit: 'набор', img: svgImg('Оттискной силикон', 'Ортопедия') },
          { name: 'Цемент стеклоиономерный', brand: 'GC Fuji', cat: 'Ортопедия', catId: prostheticsId, price: 3200, desc: 'Стеклоиономерный цемент Fuji I', stock: 35, unit: 'набор', img: svgImg('GC Fuji цемент', 'Ортопедия') },
          { name: 'Коронка металлокерамическая', brand: 'Ivoclar', cat: 'Ортопедия', catId: prostheticsId, price: 18000, desc: 'Металлокерамическая коронка на CoCr', stock: 20, unit: 'шт', img: svgImg('Коронка металлокерамическая', 'Ортопедия') },
          { name: 'Диоксид циркония (блок)', brand: 'Ivoclar', cat: 'Ортопедия', catId: prostheticsId, price: 12000, desc: 'Блок диоксида циркония для CAD/CAM', stock: 15, unit: 'шт', img: svgImg('Диоксид циркония', 'Ортопедия') },
          // Профилактика
          { name: 'Паста Polishing', brand: 'Ivoclar', cat: 'Профилактика', catId: preventionId, price: 1800, desc: 'Полировочная паста Proxyt', stock: 60, unit: 'шприц', img: svgImg('Паста Proxyt', 'Профилактика') },
          { name: 'Герметик фиссурный', brand: '3M ESPE', cat: 'Профилактика', catId: preventionId, price: 2500, desc: 'Герметик Clinpro Sealant', stock: 40, unit: 'шприц', img: svgImg('Герметик Clinpro', 'Профилактика') },
          { name: 'Флосс вощёный', brand: 'Oral-B', cat: 'Профилактика', catId: preventionId, price: 350, desc: 'Зубная нить вощёная', stock: 150, unit: 'упак', img: svgImg('Флосс вощёный', 'Профилактика') },
          // Хирургия
          { name: 'Шовный материал Vicryl 4-0', brand: 'Ethicon', cat: 'Хирургия', catId: surgeryId, price: 850, desc: 'Рассасывающийся шовный материал', stock: 100, unit: 'шт', img: svgImg('Vicryl 4-0', 'Хирургия') },
          { name: 'Скальпель одноразовый #15', brand: 'Feather', cat: 'Хирургия', catId: surgeryId, price: 220, desc: 'Хирургический скальпель #15', stock: 200, unit: 'шт', img: svgImg('Скальпель #15', 'Хирургия') },
          { name: 'Кюрета хирургическая', brand: 'Hu-Friedy', cat: 'Хирургия', catId: surgeryId, price: 1800, desc: 'Хирургическая кюрета Lucas #86', stock: 15, unit: 'шт', img: svgImg('Кюрета Lucas #86', 'Хирургия') },
        ];
        for (const p of products) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "products" (id, name, brand, category, "categoryId", price, description, stock, unit, "imageUrl", "supplierId", "isActive") VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT DO NOTHING`,
            p.name, p.brand, p.cat, p.catId, p.price, p.desc, p.stock, p.unit, p.img, sid
          );
        }
        console.log(`[SEED] ${products.length} products created`);
      }
    }
  } catch (err) {
    console.warn('[SEED] Products seed failed (non-fatal):', err);
  }

  // Rename Scandonest -> Мепивакаин 3% без эпинефрина (idempotent, existing rows)
  try {
    const renamed = await prisma.$executeRawUnsafe(
      `UPDATE "products" SET name = 'Мепивакаин 3% без эпинефрина' WHERE name = 'Scandonest'`
    );
    if (renamed) console.log(`[SEED] Renamed ${renamed} Scandonest -> Мепивакаин 3% без эпинефрина`);
  } catch (err) {
    console.warn('[SEED] Product rename failed (non-fatal):', err);
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
