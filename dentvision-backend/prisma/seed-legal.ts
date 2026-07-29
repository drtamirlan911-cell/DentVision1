import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[SEED-LEGAL] DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const FILE_TO_TYPE: Record<string, string> = {
  'clinic-agreement.md': 'CLINIC_AGREEMENT',
  'diagnostics-agreement.md': 'DIAGNOSTICS_AGREEMENT',
  'laboratory-agreement.md': 'LABORATORY_AGREEMENT',
  'supplier-agreement.md': 'SUPPLIER_AGREEMENT',
  'lecturer-agreement.md': 'LECTURER_AGREEMENT',
  'nda.md': 'NDA',
  'dpa.md': 'DPA',
  'sla.md': 'SLA',
  'privacy-policy.md': 'PRIVACY_POLICY',
  'terms-of-service.md': 'TERMS_OF_SERVICE',
  'ai-policy.md': 'AI_POLICY',
  'cookie-policy.md': 'COOKIE_POLICY',
  'marketplace-offer.md': 'MARKETPLACE_AGREEMENT',
  'patient-personal-data-consent.md': 'PRIVACY_POLICY',
  'patient-ai-consent.md': 'AI_POLICY',
};

const DISPLAY_NAMES: Record<string, string> = {
  'clinic-agreement.md': 'Договор с клиникой (публичная оферта)',
  'diagnostics-agreement.md': 'Договор с диагностическим центром',
  'laboratory-agreement.md': 'Договор с зуботехической лабораторией',
  'supplier-agreement.md': 'Агентский договор с поставщиком',
  'lecturer-agreement.md': 'Договор с лектором',
  'nda.md': 'Соглашение о конфиденциальности (NDA)',
  'dpa.md': 'Data Processing Agreement (DPA)',
  'sla.md': 'Service Level Agreement (SLA)',
  'privacy-policy.md': 'Политика конфиденциальности',
  'terms-of-service.md': 'Пользовательское соглашение (ToS)',
  'ai-policy.md': 'Политика использования AI',
  'cookie-policy.md': 'Политика использования Cookie',
  'marketplace-offer.md': 'Оферта маркетплейса',
  'patient-personal-data-consent.md': 'Согласие пациента на обработку ПД',
  'patient-ai-consent.md': 'Согласие пациента на AI-обработку',
};

const EXTRAS: Record<string, { description: string; category: string }> = {
  'clinic-agreement.md': { description: 'Публичная оферта для подключения клиник к платформе DentVision', category: 'core' },
  'diagnostics-agreement.md': { description: 'Договор услуг с диагностическими центрами + реферальная система', category: 'core' },
  'laboratory-agreement.md': { description: 'Договор об оказании услуг зуботехнической лаборатории', category: 'core' },
  'supplier-agreement.md': { description: 'Агентский договор с поставщиками маркетплейса', category: 'core' },
  'lecturer-agreement.md': { description: 'Договор услуг + лицензионный договор с лектором Academy OS', category: 'core' },
  'nda.md': { description: 'Двустороннее соглашение о конфиденциальности', category: 'legal' },
  'dpa.md': { description: 'Data Processing Agreement — обработка ПД по поручению клиники', category: 'compliance' },
  'sla.md': { description: 'Service Level Agreement — уровень доступности и время реакции', category: 'tech' },
  'privacy-policy.md': { description: 'Политика конфиденциальности (Закон РК №94-V)', category: 'compliance' },
  'terms-of-service.md': { description: 'Пользовательское соглашение (Terms of Service)', category: 'legal' },
  'ai-policy.md': { description: 'Политика использования искусственного интеллекта', category: 'compliance' },
  'cookie-policy.md': { description: 'Политика использования файлов cookie', category: 'compliance' },
  'marketplace-offer.md': { description: 'Оферта маркетплейса — агрегатор товаров и услуг', category: 'core' },
  'patient-personal-data-consent.md': { description: 'Согласие пациента на обработку персональных данных', category: 'consent' },
  'patient-ai-consent.md': { description: 'Согласие пациента на AI-обработку медицинских данных', category: 'consent' },
};

function extractVariables(content: string): string[] {
  const vars = content.match(/\{\{\w+\}\}/g);
  if (!vars) return [];
  return [...new Set(vars.map(v => v.replace(/[{}]/g, '')))].sort();
}

async function main() {
  const legalDir = path.resolve(__dirname, '../../legal');
  console.log(`[SEED-LEGAL] Scanning: ${legalDir}`);

  if (!fs.existsSync(legalDir)) {
    console.error('[SEED-LEGAL] legal/ directory not found at', legalDir);
    process.exit(1);
  }

  const rows = await sql.query('SELECT id, role FROM "users" WHERE role IN ($1, $2) LIMIT 1', ['SUPERADMIN', 'ADMIN']);
  if (rows.length === 0) {
    console.error('[SEED-LEGAL] No superadmin/admin user found. Seed users first.');
    process.exit(1);
  }
  const userId = rows[0].id;
  console.log(`[SEED-LEGAL] Using user: ${userId} (${rows[0].role})`);

  const dirs = ['contracts', 'policies', 'consents'];
  let created = 0;

  for (const dir of dirs) {
    const dirPath = path.join(legalDir, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const templateType = FILE_TO_TYPE[file];
      if (!templateType) {
        console.log(`  [SKIP] ${file} — no mapping`);
        continue;
      }

      const existing = await sql.query('SELECT id FROM legal_templates WHERE type = $1 LIMIT 1', [templateType]);
      if (existing.length > 0) {
        console.log(`  [SKIP] ${file} — already exists as ${templateType}`);
        continue;
      }

      const vars = extractVariables(content);
      const name = DISPLAY_NAMES[file] || file.replace('.md', '');
      const extra = EXTRAS[file] || { description: '', category: 'other' };

      const templateResult = await sql.query(
        `INSERT INTO legal_templates (id, type, name, description, blocks, variables, "currentVersion", "createdBy", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1::"TemplateType", $2, $3, $4::text[], $5::jsonb, 1, $6, NOW(), NOW())
         RETURNING id`,
        [templateType, name, extra.description, '{}', JSON.stringify(vars), userId]
      );
      const templateId = templateResult[0].id;

      await sql.query(
        `INSERT INTO legal_template_versions (id, "templateId", version, content, status, "createdBy", "createdAt", changelog)
         VALUES (gen_random_uuid()::text, $1, 1, $2, 'DRAFT', $3, NOW(), $4)`,
        [templateId, content, userId, 'Первоначальная версия из пакета юридических документов']
      );

      console.log(`  [OK] ${file} → ${templateType} (id: ${templateId.slice(0, 8)}…)`);
      created++;
    }
  }

  console.log(`\n[SEED-LEGAL] Done. Created ${created} templates from ${legalDir}`);
}

main()
  .catch(e => { console.error('[SEED-LEGAL] Failed:', e); process.exit(1); })
  .finally(() => process.exit(0));
