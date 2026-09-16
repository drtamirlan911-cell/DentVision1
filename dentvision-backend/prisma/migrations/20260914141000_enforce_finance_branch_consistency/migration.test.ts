import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20260914141000_enforce_finance_branch_consistency/migration.sql');

describe('finance branch consistency migration', () => {
  const source = readFileSync(migration, 'utf8');
  it('covers both clinic finance tables', () => {
    expect(source).toContain('ON invoices'); expect(source).toContain('ON expenses');
  });
  it('never accepts an active branch from another clinic', () => {
    expect(source).toContain("RAISE EXCEPTION 'finance record branch does not belong to clinic'");
    expect(source).toContain('AND b.active = true');
    expect(source).toContain('branch_clinic_id IS DISTINCT FROM NEW."clinicId"');
  });
  it('does not invent a branch for platform-only finance rows', () => {
    expect(source).toContain('WHERE b.clinic_id = NEW."clinicId"');
    expect(source).toContain('IF NEW."branch_id" IS NULL THEN');
  });
});
