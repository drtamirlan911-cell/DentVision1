import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('legacy clinic trial migration', () => {
  it('assigns a 30-day trial to legacy DEMO clinics without resetting existing subscriptions', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261029101000_backfill_legacy_clinic_trials/migration.sql'),
      'utf8',
    );

    expect(sql).toContain('FROM "clinics" AS c');
    expect(sql).toContain('c."plan" = \'DEMO\'');
    expect(sql).toContain("INTERVAL '30 days'");
    expect(sql).toContain("THEN 'expired'");
    expect(sql).toContain("ELSE 'trialing'");
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('s."ownerId" = c."id"');
    expect(sql).toContain('FROM "subscriptions" AS s');
    expect(sql).toContain('s."status" IN (\'active\', \'trialing\')');
    expect(sql).toContain('s."periodEnd" IS NULL');
    expect(sql).toContain('SET "active" = true');
    expect(sql).toContain('s."status" = \'expired\'');
    expect(sql).toContain('s."periodEnd" = c."createdAt" + INTERVAL \'30 days\'');
    expect(sql).toContain('c."plan" = \'DEMO\'');
    expect(sql).toContain('c."active" = false');
    expect(sql).toContain('s."status" = \'trialing\'');
    expect(sql).toContain('s."createdAt" + INTERVAL \'30 days\'');
    expect(sql).toContain('s."periodEnd" IS NULL');
    expect(sql).toContain('c."plan" <> \'DEMO\'');
  });

  it('adds only a nullable archive timestamp and an index without deleting organizations', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261029100000_add_organization_soft_archive/migration.sql'),
      'utf8',
    );

    expect(sql).toContain('ADD COLUMN "archivedAt" TIMESTAMP(3)');
    expect(sql).toContain('"organizations_archivedAt_idx"');
    expect(sql).not.toContain('DELETE FROM');
    expect(sql).not.toContain('UPDATE "clinics"');
  });
});
