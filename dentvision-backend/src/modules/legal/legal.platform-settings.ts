import prisma from '../../lib/prisma.js';
import { PLATFORM_INFO } from './legal.constants.js';

const TABLE = 'legal_platform_settings';
const SETTINGS_ID = 'platform_defaults';

async function ensureTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${TABLE}" (
        id TEXT PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {
    // Idempotent: table already exists.
  }
}

export async function getPlatformSettings(): Promise<Record<string, string>> {
  await ensureTable();
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT settings FROM "${TABLE}" WHERE id = $1`,
      SETTINGS_ID,
    );
    if (rows?.length > 0) {
      return { ...PLATFORM_INFO, ...(rows[0].settings as Record<string, string>) };
    }
  } catch {
    // Table not ready yet or query failed — fall back to defaults below.
  }
  return { ...PLATFORM_INFO };
}

export async function updatePlatformSettings(updates: Record<string, string>): Promise<Record<string, string>> {
  await ensureTable();
  const current = await getPlatformSettings();
  const merged = { ...current, ...updates };
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${TABLE}" (id, settings, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET settings = $2::jsonb, updated_at = NOW()`,
    SETTINGS_ID,
    JSON.stringify(merged),
  );
  return merged;
}
