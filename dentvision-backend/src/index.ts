import app from './app.js';
import { env } from './config.js';
import prisma from './lib/prisma.js';
import { eventBus } from './modules/events/index.js';
import { getEventOrchestrator } from './modules/ai/os/index.js';
import { startReminderCronInterval } from './jobs/reminderCron.js';
import { startSubscriptionCronInterval } from './jobs/subscriptionCron.js';
import { startSettlementCronInterval } from './jobs/settlementCron.js';
import { startMessageWorker } from './modules/ai-admin/index.js';
import { CLINICAL_CASES, LIBRARY_ITEMS } from './modules/school/academyContent.js';
import { onboardPartner } from './modules/legal/legal.service.js';
import { grantDiagnosticsAccess } from './modules/diagnostics/diagnostics.service.js';
import { uid } from './lib/helpers.js';

const orchestrator = getEventOrchestrator({ logLevel: 'info' });

// Legal template pack seeded at startup (idempotent by type) so agreements/NDA are
// generated on partner onboarding. Without them onboardPartner produces zero documents.
const LEGAL_SEED_TEMPLATES: Array<{ type: string; name: string; description: string; variables: string[]; content: string }> = [
  {
    type: 'SUPPLIER_AGREEMENT',
    name: 'Агентский договор с поставщиком',
    description: 'Агентский договор с поставщиками маркетплейса (фиксированная комиссия 10%)',
    variables: ['SupplierName', 'SupplierBIN', 'SupplierDirector', 'SupplierDirectorDoc', 'SupplierDirectorTitle', 'SupplierAddress', 'SupplierBank', 'SupplierBIC', 'SupplierKBE', 'SupplierIBAN', 'SupplierPhone', 'SupplierEmail', 'CommissionRate', 'ContractNumber'],
    content: [
      '<h2>АГЕНТСКИЙ ДОГОВОР № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p><strong>DentVision</strong> (далее — «Платформа»), с одной стороны, и <strong>{{SupplierName}}</strong>, БИН {{SupplierBIN}}, в лице {{SupplierDirector}}, действующего на основании {{SupplierDirectorDoc}} ({{SupplierDirectorTitle}}), далее — «Поставщик», с другой стороны, заключили настоящий договор о нижеследующем:</p>',
      '<h3>1. Предмет договора</h3>',
      '<p>1.1. Платформа предоставляет Поставщику доступ к маркетплейсу стоматологических товаров; Поставщик размещает товары и принимает заказы через Платформу.</p>',
      '<p>1.2. Реализация товаров осуществляется от имени и по поручению Платформы в рамках агентской модели.</p>',
      '<h3>2. Комиссия Платформы</h3>',
      '<p>2.1. За услуги Платформы Поставщик уплачивает вознаграждение в размере <strong>{{CommissionRate}}%</strong> от суммы каждой продажи (далее — «Комиссия»). Комиссия является фиксированной на весь срок действия договора.</p>',
      '<p>2.2. Комиссия удерживается автоматически из выплат Поставщику по итогам каждого расчётного периода.</p>',
      '<h3>3. Обязанности сторон</h3>',
      '<p>3.1. Поставщик гарантирует актуальность остатков, сроков и цен; обрабатывает заказы в срок.</p>',
      '<p>3.2. Платформа обеспечивает работу маркетплейса, приём платежей и передачу заказов.</p>',
      '<h3>4. Реквизиты сторон</h3>',
      '<p><strong>Платформа:</strong> DentVision, г. Алматы, ул. Абая 150, офис 301.</p>',
      '<p><strong>Поставщик:</strong> {{SupplierName}}, БИН {{SupplierBIN}}, юридический адрес: {{SupplierAddress}}, телефон: {{SupplierPhone}}, e-mail: {{SupplierEmail}}, банк: {{SupplierBank}}, БИК: {{SupplierBIC}}, КБЕ: {{SupplierKBE}}, IBAN: {{SupplierIBAN}}.</p>',
      '<p>Настоящий договор вступает в силу с момента подписания и действует до момента прекращения размещения товаров на Платформе.</p>',
    ].join('\n'),
  },
  {
    type: 'NDA',
    name: 'Соглашение о конфиденциальности (NDA)',
    description: 'Двустороннее соглашение о конфиденциальности',
    variables: ['SupplierName', 'SupplierBIN', 'SupplierDirector', 'ContractNumber', 'PartnerName', 'PartnerBIN'],
    content: [
      '<h2>СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и <strong>{{SupplierName}}</strong> (БИН {{SupplierBIN}}) в лице {{SupplierDirector}} (далее — «Сторона») заключили настоящее соглашение о конфиденциальности.</p>',
      '<p><strong>1.</strong> Стороны обязуются не разглашать конфиденциальную информацию, полученную при сотрудничестве: коммерческие условия, персональные данные, сведения о клиентах, партнёрах и внутренней работе платформы.</p>',
      '<p><strong>2.</strong> Конфиденциальная информация используется исключительно в целях исполнения договора между Сторонами.</p>',
      '<p><strong>3.</strong> Обязательства сторон по настоящему соглашению действуют в течение 3 (трёх) лет после прекращения сотрудничества.</p>',
    ].join('\n'),
  },
  {
    type: 'DIAGNOSTICS_AGREEMENT',
    name: 'Договор с диагностическим центром',
    description: 'Договор услуг с диагностическими центрами + реферальная система',
    variables: ['DiagnosticsName', 'DiagnosticsBIN', 'DiagnosticsAddress', 'DiagnosticsPhone', 'DiagnosticsEmail', 'DiagnosticsIBAN', 'CommissionRate', 'ContractNumber'],
    content: [
      '<h2>ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и <strong>{{DiagnosticsName}}</strong> (БИН {{DiagnosticsBIN}}, далее — «Центр») заключили настоящий договор.</p>',
      '<h3>1. Предмет</h3>',
      '<p>1.1. Центр принимает пациентов по направлениям, сформированным в Платформе, выполняет диагностические исследования и загружает результаты.</p>',
      '<h3>2. Комиссия Платформы</h3>',
      '<p>2.1. Комиссия Платформы за реферальный поток составляет <strong>{{CommissionRate}}%</strong> от суммы оказанных услуг.</p>',
      '<p>2.2. Комиссия удерживается из выплат Центру по итогам расчётного периода.</p>',
      '<h3>3. Реквизиты Центра</h3>',
      '<p>{{DiagnosticsName}}, БИН {{DiagnosticsBIN}}, адрес: {{DiagnosticsAddress}}, телефон: {{DiagnosticsPhone}}, e-mail: {{DiagnosticsEmail}}, IBAN: {{DiagnosticsIBAN}}.</p>',
    ].join('\n'),
  },
  {
    type: 'LABORATORY_AGREEMENT',
    name: 'Договор с зуботехнической лабораторией',
    description: 'Договор об оказании услуг зуботехнической лаборатории',
    variables: ['LaboratoryName', 'LaboratoryBIN', 'LaboratoryAddress', 'LaboratoryPhone', 'LaboratoryEmail', 'LaboratoryIBAN', 'CommissionRate', 'ContractNumber'],
    content: [
      '<h2>ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и <strong>{{LaboratoryName}}</strong> (БИН {{LaboratoryBIN}}, далее — «Лаборатория») заключили настоящий договор.</p>',
      '<h3>1. Предмет</h3>',
      '<p>1.1. Лаборатория принимает заказы от клиник платформы и выполняет зуботехнические работы.</p>',
      '<h3>2. Комиссия Платформы</h3>',
      '<p>2.1. Комиссия Платформы составляет <strong>{{CommissionRate}}%</strong> от суммы выполненных заказов.</p>',
      '<h3>3. Реквизиты Лаборатории</h3>',
      '<p>{{LaboratoryName}}, БИН {{LaboratoryBIN}}, адрес: {{LaboratoryAddress}}, телефон: {{LaboratoryPhone}}, e-mail: {{LaboratoryEmail}}, IBAN: {{LaboratoryIBAN}}.</p>',
    ].join('\n'),
  },
  {
    type: 'CLINIC_AGREEMENT',
    name: 'Договор с клиникой (публичная оферта)',
    description: 'Публичная оферта для подключения клиник к платформе DentVision',
    variables: ['ClinicName', 'ClinicBIN', 'ClinicAddress', 'ClinicPhone', 'ClinicEmail', 'ClinicIBAN', 'ClinicDirectorTitle', 'ClinicLicense', 'ContractNumber'],
    content: [
      '<h2>ДОГОВОР О ПОДКЛЮЧЕНИИ К ПЛАТФОРМЕ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и клиника <strong>{{ClinicName}}</strong> (БИН {{ClinicBIN}}, далее — «Клиника») заключили настоящий договор.</p>',
      '<h3>1. Предмет</h3>',
      '<p>1.1. Платформа предоставляет Клинике доступ к CRM, системе записи, финансам и маркетплейсу; лицензия на медицинскую деятельность: {{ClinicLicense}}.</p>',
      '<h3>2. Реквизиты Клиники</h3>',
      '<p>{{ClinicName}}, БИН {{ClinicBIN}}, адрес: {{ClinicAddress}}, телефон: {{ClinicPhone}}, e-mail: {{ClinicEmail}}, IBAN: {{ClinicIBAN}}, руководитель: {{ClinicDirectorTitle}}.</p>',
    ].join('\n'),
  },
  {
    type: 'LECTURER_AGREEMENT',
    name: 'Договор с лектором',
    description: 'Договор на размещение курсов и вебинаров лектором на платформе',
    variables: ['LecturerName', 'LecturerBIN', 'LecturerAddress', 'LecturerPhone', 'LecturerEmail', 'LecturerIBAN', 'CommissionRate', 'ContractNumber'],
    content: [
      '<h2>ДОГОВОР С ЛЕКТОРОМ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и <strong>{{LecturerName}}</strong> (БИН {{LecturerBIN}}, далее — «Лектор») заключили настоящий договор.</p>',
      '<h3>1. Предмет</h3>',
      '<p>1.1. Лектор размещает образовательные курсы и вебинары на платформе через Academy OS; Платформа обеспечивает доступ слушателей.</p>',
      '<h3>2. Комиссия Платформы</h3>',
      '<p>2.1. Комиссия Платформы составляет <strong>{{CommissionRate}}%</strong> от стоимости проданных курсов.</p>',
      '<h3>3. Реквизиты Лектора</h3>',
      '<p>{{LecturerName}}, БИН {{LecturerBIN}}, адрес: {{LecturerAddress}}, телефон: {{LecturerPhone}}, e-mail: {{LecturerEmail}}, IBAN: {{LecturerIBAN}}.</p>',
    ].join('\n'),
  },
  {
    type: 'ACADEMY_AGREEMENT',
    name: 'Договор с учебным центром',
    description: 'Договор на размещение академии / учебного центра на платформе',
    variables: ['AcademyName', 'AcademyBIN', 'AcademyAddress', 'AcademyPhone', 'AcademyEmail', 'AcademyIBAN', 'CommissionRate', 'ContractNumber'],
    content: [
      '<h2>ДОГОВОР С УЧЕБНЫМ ЦЕНТРОМ № {{ContractNumber}}</h2>',
      '<p>г. Алматы</p>',
      '<p>DentVision (далее — «Платформа») и <strong>{{AcademyName}}</strong> (БИН {{AcademyBIN}}, далее — «Академия») заключили настоящий договор.</p>',
      '<h3>1. Предмет</h3>',
      '<p>1.1. Академия размещает программы обучения и курсы на платформе; Платформа привлекает слушателей и обеспечивает техническую инфраструктуру.</p>',
      '<h3>2. Комиссия Платформы</h3>',
      '<p>2.1. Комиссия Платформы составляет <strong>{{CommissionRate}}%</strong> от стоимости проданных курсов и программ.</p>',
      '<h3>3. Реквизиты Академии</h3>',
      '<p>{{AcademyName}}, БИН {{AcademyBIN}}, адрес: {{AcademyAddress}}, телефон: {{AcademyPhone}}, e-mail: {{AcademyEmail}}, IBAN: {{AcademyIBAN}}.</p>',
    ].join('\n'),
  },
];

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

// ─── One-time startup schema migrations ─────────────────────────────
// The DDL blocks below are idempotent (IF NOT EXISTS) but each one costs a
// round trip on every boot. They run exactly once and are remembered in the
// `schema_migrations` table; on later boots the gate below skips them. Data
// backfills/seeds are intentionally NOT gated — they must keep running to
// catch new rows (new centers, approved registrations, suppliers, ...).
let schemaMigrationsReady = false;
async function ensureSchemaMigrationsTable() {
  if (schemaMigrationsReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "key" TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "durationMs" INT
    )
  `);
  schemaMigrationsReady = true;
}
async function hasRunMigration(key: string): Promise<boolean> {
  await ensureSchemaMigrationsTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM "schema_migrations" WHERE "key" = $1`, key,
  );
  return (rows[0]?.n ?? 0) > 0;
}
async function markMigrationDone(key: string, durationMs: number) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "schema_migrations" ("key", "appliedAt", "durationMs") VALUES ($1, now(), $2)
     ON CONFLICT ("key") DO NOTHING`, key, durationMs,
  );
}
/** Run a one-time DDL block unless it already applied on a previous boot. */
async function runOnceMigration(key: string, label: string, fn: () => Promise<void>) {
  if (await hasRunMigration(key)) {
    console.log(`[MIGRATION] ${label} — skipped (already applied)`);
    return;
  }
  const t0 = Date.now();
  try {
    // Wrap in a transaction so partial failures roll back cleanly.
    await prisma.$transaction(async () => { await fn(); });
    await markMigrationDone(key, Date.now() - t0);
    console.log(`[MIGRATION] ${label} ready (${Date.now() - t0}ms)`);
  } catch (err) {
    console.error(`[MIGRATION] ${label} failed (will retry next boot):`, err);
    // Do NOT mark as done — the transaction rolled back, so next boot retries.
  }
}

async function main() {
  await connectDb();
  await ensureSchemaMigrationsTable();

  // Run schema migrations
  await runOnceMigration('patients_iin', 'Patient.iin column', async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "patients" ADD COLUMN IF NOT EXISTS "iin" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "patients_iin_idx" ON "patients"("iin")`);
  });

  // UserRole enum may be missing SUPPORT (init_full_schema was generated before it was added)
  await runOnceMigration('userrole_support', 'UserRole SUPPORT value', async () => {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT'`);
  });

  // Diagnostic center subscriptions
  await runOnceMigration('center_subscriptions_table', 'Center subscription table', async () => {
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
  });

  // Backfill trial subscriptions for existing centers that don't have one yet
  try {
    const res = await prisma.$executeRawUnsafe(`
      INSERT INTO "center_subscriptions" (center_id, status, trial_end)
      SELECT dc.id::uuid, 'trial', now() + interval '30 days'
      FROM "diagnostic_centers" dc
      WHERE dc.active = true
        AND NOT EXISTS (SELECT 1 FROM "center_subscriptions" cs WHERE cs.center_id = dc.id::uuid)
    `);
    console.log(`[MIGRATION] Center subscriptions backfilled for ${res} centers`);
  } catch (err) {
    console.error('[MIGRATION] Center subscription backfill failed (non-fatal):', err);
  }

  // Shared product catalog — prevent duplicate listings across suppliers
  await runOnceMigration('products_shared_id', 'Product shared_product_id column', async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE IF EXISTS "products" ADD COLUMN IF NOT EXISTS "shared_product_id" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "products_shared_idx" ON "products"("shared_product_id")`);
  });

  // Ensure marketplace tables exist (init_full_schema migration may have failed)
  if (await hasRunMigration('marketplace_iam_finance')) {
    console.log('[MIGRATION] Marketplace + IAM + Finance tables — skipped (already applied)');
  } else {
    const t0 = Date.now();
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
        "originalType" TEXT,
        "originalId" TEXT,
        "taxId" TEXT,
        logo TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        contacts JSONB,
        settings JSONB,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "updatedAt" TIMESTAMPTZ,
        UNIQUE("originalType", "originalId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "persons" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "fullName" TEXT NOT NULL,
        "personType" TEXT NOT NULL DEFAULT 'STAFF',
        organization_id UUID,
        "userId" UUID,
        phone TEXT,
        email TEXT,
        specialization TEXT,
        bio TEXT,
        avatar TEXT,
        contacts JSONB,
        "originalType" TEXT,
        "originalId" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "updatedAt" TIMESTAMPTZ,
        UNIQUE("originalType", "originalId")
      )
    `);
    // Normalize existing organizations/persons columns to Prisma camelCase (older DBs created snake_case)
    const columnExists = async (table: string, col: string) => {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        table, col
      );
      return (rows[0]?.n ?? 0) > 0;
    };
    const fixColumns = async (table: string, renames: Array<[string, string]>, adds: Array<[string, string]>) => {
      for (const [from, to] of renames) {
        try {
          if (await columnExists(table, from)) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`);
          }
        } catch (e: any) { console.warn(`[MIGRATION] rename ${table}.${from} failed:`, e?.message); }
      }
      for (const [name, ddl] of adds) {
        try {
          if (!(await columnExists(table, name))) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
          }
        } catch (e: any) { console.warn(`[MIGRATION] add ${table}.${name} failed:`, e?.message); }
      }
    };
    await fixColumns('organizations', [
      ['original_type', 'originalType'], ['original_id', 'originalId'],
      ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
    ], [
      ['taxId', '"taxId" TEXT'],
      ['settings', 'settings JSONB'],
    ]);
    await fixColumns('persons', [
      ['full_name', 'fullName'], ['person_type', 'personType'],
      ['user_id', 'userId'], ['created_at', 'createdAt'], ['updated_at', 'updatedAt'],
    ], [
      ['email', 'email TEXT'],
      ['bio', 'bio TEXT'],
      ['avatar', 'avatar TEXT'],
      ['contacts', 'contacts JSONB'],
      ['originalType', '"originalType" TEXT'],
      ['originalId', '"originalId" TEXT'],
    ]);
    console.log('[MIGRATION] organizations/persons columns normalized to Prisma camelCase');
    // Align diagnostics org ids with entity ids (token.organizationId must equal
    // the center/lab id used by /diagnostics routes and CenterDashboard).
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "persons" SET "organization_id" = o."originalId"
        FROM "organizations" o
        WHERE "persons"."organization_id" = o.id
          AND o."originalType" IN ('DiagnosticCenter','Laboratory')
          AND o.id <> o."originalId"
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "organizations" SET id = "originalId"
        WHERE "originalType" IN ('DiagnosticCenter','Laboratory')
          AND id <> "originalId"
      `);
      console.log('[MIGRATION] diagnostics org ids aligned to entity ids');
    } catch (e: any) {
      console.warn('[MIGRATION] align diagnostics org ids failed (non-fatal):', e?.message);
    }
    // Create RBAC + legacy membership tables (init_full_schema failed in prod, so they may be missing)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "clinic_members" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "clinicId" UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'DOCTOR',
        "commissionPercent" INT NOT NULL DEFAULT 30,
        "baseSalary" INT NOT NULL DEFAULT 0,
        "payType" TEXT NOT NULL DEFAULT 'commission',
        "joinedAt" TIMESTAMPTZ DEFAULT now(),
        "updatedAt" TIMESTAMPTZ,
        UNIQUE("userId", "clinicId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "roles" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "person_roles" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "personId" UUID NOT NULL,
        "roleId" UUID NOT NULL,
        "scopeType" TEXT,
        "scopeId" TEXT,
        UNIQUE("personId", "roleId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        domain TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "roleId" UUID NOT NULL,
        "permissionId" UUID NOT NULL,
        PRIMARY KEY ("roleId", "permissionId")
      )
    `);
    console.log('[MIGRATION] RBAC + clinic_members tables ready');
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
    await markMigrationDone('marketplace_iam_finance', Date.now() - t0);
  } catch (err) {
    console.error('[MIGRATION] Marketplace tables failed (non-fatal):', err);
  }
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

  // Backfill starter catalog for existing suppliers with no products yet.
  try {
    const dvSupplier = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "suppliers" WHERE name = 'DentVision' LIMIT 1`);
    if (dvSupplier.length > 0) {
      const emptySuppliers = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT s.id FROM "suppliers" s WHERE s.name <> 'DentVision' AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."supplierId" = s.id) LIMIT 20`,
      );
      const srcProducts = await prisma.product.findMany({ where: { supplierId: dvSupplier[0].id, isActive: true }, take: 200 });
      for (const s of emptySuppliers) {
        if (srcProducts.length > 0) {
          await prisma.product.createMany({
            data: srcProducts.map((p) => ({
              id: uid(), name: p.name, brand: p.brand, category: p.category, categoryId: p.categoryId,
              price: p.price, oldPrice: p.oldPrice, stock: p.stock, minStock: p.minStock,
              description: p.description, imageUrl: p.imageUrl, images: p.images, rating: p.rating,
              reviewCount: 0, supplierId: s.id, ownBrand: false, sku: p.sku, unit: p.unit,
              currency: p.currency, tags: p.tags, specs: p.specs, manufacturer: p.manufacturer,
              country: p.country, compatibility: p.compatibility, isActive: true,
              sharedProductId: p.sharedProductId || p.id,
            })),
          });
          console.log(`[SEED] Starter catalog duplicated to supplier ${s.id} (${srcProducts.length} products)`);
        }
      }
    }
  } catch (err) {
    console.warn('[SEED] Starter catalog backfill failed (non-fatal):', err);
  }

  // School content tables
  await runOnceMigration('school_content_tables', 'School content tables', async () => {
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
    await prisma.$executeRawUnsafe(`ALTER TABLE "school_library_items" ADD COLUMN IF NOT EXISTS content TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "school_library_items" ADD COLUMN IF NOT EXISTS tags JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "school_clinical_cases" ADD COLUMN IF NOT EXISTS author TEXT`);
  });

  try {
    // Seed curated static content into DB (idempotent by title+category) so admin can edit/delete it.
    for (const c of CLINICAL_CASES) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "school_clinical_cases" (id, title, description, category, difficulty, content, author)
         SELECT gen_random_uuid(), $1, $2, $3, $4, null, $5
         WHERE NOT EXISTS (SELECT 1 FROM "school_clinical_cases" WHERE title = $1 AND category = $3)`,
        c.title, c.description || null, c.category || null, c.difficulty || 'intermediate', c.author || null,
      );
    }
    for (const it of LIBRARY_ITEMS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "school_library_items" (id, title, description, author, category, type, url)
         SELECT gen_random_uuid(), $1, null, $2, $3, $4, null
         WHERE NOT EXISTS (SELECT 1 FROM "school_library_items" WHERE title = $1 AND category = $3)`,
        it.title, it.author || null, it.category || null, it.type || 'article',
      );
    }
    console.log('[MIGRATION] School content tables ready');
  } catch (err) {
    console.error('[MIGRATION] School content tables failed (non-fatal):', err);
  }

  // ── Demo diagnostic centers (idempotent) — so referrals can be created from day one ──
  try {
    const centerCount = await prisma.diagnosticCenter.count();
    if (centerCount === 0) {
      const demoCenters = [
        { name: 'TomoDent CBCT', city: 'Алматы', address: 'пр. Аль-Фараби 77', phone: '+77002000111', description: 'КЛКТ/КТ челюстей, височно-нижнечелюстных суставов' },
        { name: 'AlphaScan 3D', city: 'Алматы', address: 'ул. Толе би 211', phone: '+77002000222', description: 'ОПТГ, ТРГ, цефалометрия' },
        { name: 'LabExpress', city: 'Астана', address: 'пр. Мангилик Ел 55', phone: '+77002000333', description: 'Гистология, ПЦР, микробиология' },
        { name: 'MedLab', city: 'Астана', address: 'ул. Кунаева 32', phone: '+77002000444', description: 'Биохимия, аллергопанели' },
      ];
      for (const c of demoCenters) {
        await prisma.diagnosticCenter.create({
          data: { id: uid(), active: true, ...c },
        });
      }
      // Add a sample CBCT study to the first center
      const firstCenter = await prisma.diagnosticCenter.findFirst({ orderBy: { createdAt: 'asc' } });
      if (firstCenter) {
        await prisma.diagnosticStudy.createMany({
          data: [
            { id: uid(), centerId: firstCenter.id, name: 'CBCT обе челюсти', category: 'CBCT', price: 15000, active: true },
            { id: uid(), centerId: firstCenter.id, name: 'CBCT одна челюсть', category: 'CBCT', price: 8000, active: true },
            { id: uid(), centerId: firstCenter.id, name: 'ОПТГ (панорамный)', category: 'OPG', price: 5000, active: true },
            { id: uid(), centerId: firstCenter.id, name: 'ТРГ (боковая)', category: 'TRG', price: 3000, active: true },
          ],
        });
      }
      console.log(`[SEED] Created ${demoCenters.length} demo diagnostic centers`);
    }
  } catch (err) {
    console.warn('[SEED] Diagnostic centers seed failed (non-fatal):', err);
  }

  // ── Demo laboratories (idempotent) ──
  try {
    const labCount = await prisma.laboratory.count();
    if (labCount === 0) {
      const demoLabs = [
        { name: 'DentaLab', city: 'Алматы', address: 'ул. Розыбакиева 247', phone: '+77003000111', description: 'Завиши, коронки, протезы' },
        { name: 'CeramicPro', city: 'Астана', address: 'пр. Кабанбай батыра 40', phone: '+77003000222', description: 'Керамика, CAD/CAM' },
      ];
      for (const l of demoLabs) {
        await prisma.laboratory.create({
          data: { id: uid(), active: true, ...l },
        });
      }
      console.log(`[SEED] Created ${demoLabs.length} demo laboratories`);
    }
  } catch (err) {
    console.warn('[SEED] Laboratories seed failed (non-fatal):', err);
  }

  // ─── Legal templates (idempotent seed) — supplier/clinic agreements + NDA ───
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TemplateType') THEN
          EXECUTE 'CREATE TYPE "TemplateType" AS ENUM (''CLINIC_AGREEMENT'',''DIAGNOSTICS_AGREEMENT'',''LABORATORY_AGREEMENT'',''MARKETPLACE_AGREEMENT'',''SUPPLIER_AGREEMENT'',''LECTURER_AGREEMENT'',''ACADEMY_AGREEMENT'',''NDA'',''PRIVACY_POLICY'',''TERMS_OF_SERVICE'',''AI_POLICY'',''COOKIE_POLICY'',''DPA'',''SLA'',''API_AGREEMENT'',''REFERRAL_AGREEMENT'')';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus') THEN
          EXECUTE 'CREATE TYPE "DocumentStatus" AS ENUM (''DRAFT'',''REVIEW'',''APPROVED'',''PUBLISHED'',''ARCHIVED'',''EXPIRED'',''CANCELLED'')';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartnerType') THEN
          EXECUTE 'CREATE TYPE "PartnerType" AS ENUM (''MANUFACTURER'',''DISTRIBUTOR'',''ACADEMY'',''LABORATORY'',''OFFICIAL_PARTNER'',''CLINIC'',''DIAGNOSTIC_CENTER'',''SUPPLIER'',''LECTURER'',''EDUCATION_CENTER'',''RESELLER'',''CORPORATE'')';
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "legal_templates" (
        id TEXT PRIMARY KEY,
        type "TemplateType" NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        blocks TEXT[] DEFAULT '{}',
        variables JSONB,
        "currentVersion" INTEGER DEFAULT 1,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "updatedAt" TIMESTAMPTZ DEFAULT now(),
        "createdBy" TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "legal_template_versions" (
        id TEXT PRIMARY KEY,
        "templateId" TEXT NOT NULL,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        changelog TEXT,
        status "DocumentStatus" DEFAULT 'DRAFT',
        "publishedAt" TIMESTAMPTZ,
        "approvedBy" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "createdBy" TEXT NOT NULL
      )
    `);

    const legalAdmin = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "users" WHERE role IN ('SUPERADMIN','ADMIN') LIMIT 1`,
    );
    if (legalAdmin.length > 0) {
      let seeded = 0;
      for (const tpl of LEGAL_SEED_TEMPLATES) {
        const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "legal_templates" WHERE type = $1::"TemplateType" LIMIT 1`, tpl.type,
        );
        if (exists.length > 0) continue;
        const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO "legal_templates" (id, type, name, description, blocks, variables, "currentVersion", "createdBy", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1::"TemplateType", $2, $3, '{}', $4::jsonb, 1, $5, NOW(), NOW())
           RETURNING id`,
          tpl.type, tpl.name, tpl.description, JSON.stringify(tpl.variables), legalAdmin[0].id,
        );
        if (inserted[0]) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "legal_template_versions" (id, "templateId", version, content, status, "createdBy", "createdAt", changelog)
             VALUES (gen_random_uuid()::text, $1, 1, $2, 'DRAFT', $3, NOW(), $4)`,
            inserted[0].id, tpl.content, legalAdmin[0].id, 'Первоначальная версия из пакета юридических документов',
          );
          seeded++;
        }
      }
      console.log(`[LEGAL] Templates ready (${seeded} new)`);
    } else {
      console.warn('[LEGAL] No superadmin/admin found — skipping legal template seed');
    }
  } catch (err) {
    console.error('[LEGAL] Template seed failed (non-fatal):', err);
  }

  // ─── Supplier legal partners backfill (existing suppliers get agreement + 10% commission) ───
  try {
    const legalAdmin = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "users" WHERE role IN ('SUPERADMIN','ADMIN') LIMIT 1`,
    );
    if (legalAdmin.length > 0) {
      const members = await prisma.supplierMember.findMany({ include: { supplier: true } });
      let onboarded = 0;
      for (const m of members) {
        const existing = await prisma.legalPartner.findUnique({ where: { userId: m.userId } });
        if (existing) continue;
        const s = m.supplier;
        await onboardPartner({
          userId: m.userId,
          type: 'SUPPLIER',
          legalName: s.name,
          bin: s.bin || '',
          director: s.contactPerson || '',
          address: s.legalAddress || '',
          iban: '',
          phone: s.phone || '',
          email: s.email || '',
          commission: 10,
        }, legalAdmin[0].id);
        await prisma.supplier.update({ where: { id: s.id }, data: { commissionRate: 1000 } });
        onboarded++;
      }
      if (onboarded) console.log(`[LEGAL] Onboarded ${onboarded} existing supplier legal partners (10% commission)`);
    }
  } catch (err) {
    console.warn('[LEGAL] Supplier legal backfill failed (non-fatal):', err);
  }

  // ─── Diagnostics: applicant org access ───
  await runOnceMigration('registration_requests_userId', 'registration_requests.userId column', async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "registration_requests" ADD COLUMN IF NOT EXISTS "userId" TEXT`);
  });

  // Backfill access for already-approved registrations (match applicant by email) so the
  // request creator gets the center/lab org right away.
  try {
    const approved = await prisma.$queryRawUnsafe<Array<{ id: string; type: string; email: string | null }>>(
      `SELECT id, type, email FROM "registration_requests" WHERE status = 'APPROVED'`,
    );
    let linked = 0;
    for (const r of approved) {
      if (!r.email) continue;
      const user = await prisma.user.findUnique({
        where: { email: String(r.email).toLowerCase().trim() },
        select: { id: true },
      });
      if (!user) continue;
      if (r.type === 'center') {
        const center = await prisma.diagnosticCenter.findFirst({ where: { email: r.email }, orderBy: { createdAt: 'desc' } });
        if (!center) continue;
        const ok = await grantDiagnosticsAccess('DiagnosticCenter', center.id, user.id, 'owner');
        if (ok) linked++;
      } else {
        const lab = await prisma.laboratory.findFirst({ where: { email: r.email }, orderBy: { createdAt: 'desc' } });
        if (!lab) continue;
        const ok = await grantDiagnosticsAccess('Laboratory', lab.id, user.id, 'owner');
        if (ok) linked++;
      }
    }
    if (linked) console.log(`[DIAGNOSTICS] Backfilled org access for ${linked} approved registrations`);
  } catch (err) {
    console.warn('[DIAGNOSTICS] Approved-registration access backfill failed (non-fatal):', err);
  }

  // Platform-commission settlements: table + referrals.settlementId link.
  // Mirrors prisma/migrations/20260808_add_settlement (not run via migrate deploy
  // on production), idempotent so it can re-run on every boot.
  await runOnceMigration('settlements', 'Settlement tables', async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "settlements" (
        "id" TEXT NOT NULL,
        "ownerType" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
        "periodStart" TIMESTAMP(3) NOT NULL,
        "periodEnd" TIMESTAMP(3) NOT NULL,
        "referralCount" INTEGER NOT NULL DEFAULT 0,
        "commissionMinor" BIGINT NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'open',
        "paymentId" TEXT,
        "dueDate" TIMESTAMP(3),
        "paidAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "settlements_ownerType_ownerId_idx" ON "settlements"("ownerType", "ownerId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "settlements_status_idx" ON "settlements"("status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "settlements_periodStart_periodEnd_idx" ON "settlements"("periodStart", "periodEnd")`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "settlementId" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "referrals_settlementId_idx" ON "referrals"("settlementId")`);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'referrals_settlementId_fkey'
        ) THEN
          ALTER TABLE "referrals" ADD CONSTRAINT "referrals_settlementId_fkey"
            FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);
  });

  // Document signing columns. A prisma migration for these exists
  // (20260808_add_document_sign_fields) but production reached this point
  // without the columns — every prisma.document.findMany() was failing with
  // "column documents.signToken does not exist" — so they are applied here,
  // the same way every other table in this file is kept current.
  await runOnceMigration('document_sign_fields', 'Document signing columns', async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signToken" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signatureData" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signedByName" TEXT`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "documents_signToken_key" ON "documents"("signToken")`,
    );
  });

  // One Person per (user, organization) instead of one per user. Mirrors
  // 20260808_person_multi_org; see the note above on migrations not landing.
  // The column spelling differs between tables here (persons keeps
  // organization_id while the rest were normalized to camelCase above), so
  // both are resolved at runtime.
  await runOnceMigration('person_multi_org', 'Person multi-organization index', async () => {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        user_col text;
        org_col  text;
        idx_name text;
      BEGIN
        SELECT column_name INTO user_col FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'persons' AND column_name IN ('userId', 'user_id') LIMIT 1;

        SELECT column_name INTO org_col FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'persons' AND column_name IN ('organizationId', 'organization_id') LIMIT 1;

        IF user_col IS NULL OR org_col IS NULL THEN
          RETURN;
        END IF;

        FOR idx_name IN
          SELECT i.relname FROM pg_index x
          JOIN pg_class i ON i.oid = x.indexrelid
          JOIN pg_class t ON t.oid = x.indrelid
          WHERE t.relname = 'persons' AND x.indisunique AND x.indnatts = 1
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = x.indkey[0]) = user_col
        LOOP
          EXECUTE format('ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS %I', idx_name);
          EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
        END LOOP;

        EXECUTE format(
          'CREATE UNIQUE INDEX IF NOT EXISTS "persons_userId_organizationId_key" ON public.persons (%I, %I)',
          user_col, org_col
        );
        EXECUTE format('CREATE INDEX IF NOT EXISTS "persons_userId_idx" ON public.persons (%I)', user_col);
      END $$
    `);
  });

  // Payroll configuration in the unified model. Mirrors
  // 20260808_person_compensation; applied here for the same reason as the two
  // blocks above — migrations are not reaching this database yet.
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "person_compensation" (
        "id" TEXT NOT NULL,
        "personId" TEXT NOT NULL,
        "commissionPercent" INTEGER NOT NULL DEFAULT 30,
        "baseSalary" INTEGER NOT NULL DEFAULT 0,
        "payType" TEXT NOT NULL DEFAULT 'commission',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "person_compensation_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "person_compensation_personId_key" ON "person_compensation"("personId")`,
    );
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF to_regclass('public.persons') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND constraint_name = 'person_compensation_personId_fkey'
        ) THEN
          ALTER TABLE "person_compensation" ADD CONSTRAINT "person_compensation_personId_fkey"
            FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    console.log('[MIGRATION] Person compensation table ready');
  } catch (err) {
    console.error('[MIGRATION] Person compensation table failed (non-fatal):', err);
  }

  // Performance indexes: composite btree for list/aggregate hot paths
  // (clinic-scoped lists, monthly revenue, GMV) plus trigram GIN for
  // %term% text search (patients, marketplace catalog). Idempotent.
  await runOnceMigration('performance_indexes', 'Performance indexes', async () => {
    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    } catch (err) {
      console.warn('[MIGRATION] pg_trgm unavailable — search GIN indexes skipped:', (err as Error).message);
    }

    const perfIndexes = [
      `CREATE INDEX IF NOT EXISTS "invoices_clinicId_status_createdAt_idx" ON "invoices"("clinicId", "status", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "documents_clinicId_createdAt_idx" ON "documents"("clinicId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_createdAt_idx" ON "lab_orders"("clinicId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "audit_logs_clinicId_createdAt_idx" ON "audit_logs"("clinicId", "createdAt")`,
      `CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions"("type")`,
    ];
    for (const sql of perfIndexes) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err) {
        console.warn('[MIGRATION] Perf index failed (non-fatal):', (err as Error).message);
      }
    }

    const ginIndexes = [
      `CREATE INDEX IF NOT EXISTS "patients_firstName_trgm_idx" ON "patients" USING gin ("firstName" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "patients_lastName_trgm_idx" ON "patients" USING gin ("lastName" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "patients_phone_trgm_idx" ON "patients" USING gin ("phone" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "patients_email_trgm_idx" ON "patients" USING gin ("email" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "patients_iin_trgm_idx" ON "patients" USING gin ("iin" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "products_brand_trgm_idx" ON "products" USING gin ("brand" gin_trgm_ops)`,
      `CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops)`,
    ];
    for (const sql of ginIndexes) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (err) {
        console.warn('[MIGRATION] Search GIN index failed (non-fatal):', (err as Error).message);
      }
    }
  });

  // Login attempt table for persistent brute-force protection (survives restart / multi-instance).
  await runOnceMigration('login_attempts', 'login_attempts table', async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "login_attempts" (
        "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"       TEXT NOT NULL,
        "ip"          TEXT NOT NULL,
        "count"       INTEGER NOT NULL DEFAULT 1,
        "first_attempt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "locked_until"  TIMESTAMPTZ,
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE("email", "ip")
      )
    `);
  });

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
      // Monthly platform-commission settlements (hourly interval; monthly work is
      // guarded by referral linking, so most runs are cheap no-ops).
      startSettlementCronInterval(60 * 60 * 1000);
    }
    // AI admin worker is independent of cron settings.
    try {
      startMessageWorker();
    } catch (err) {
      console.warn('[AI_ADMIN] Worker start failed (non-fatal):', err);
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
