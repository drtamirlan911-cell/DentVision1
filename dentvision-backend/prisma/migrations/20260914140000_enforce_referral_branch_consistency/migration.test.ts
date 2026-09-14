import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20260914140000_enforce_referral_branch_consistency/migration.sql');

describe('referral branch consistency migration', () => {
  const source = readFileSync(migration, 'utf8');
  it('inherits a missing referral branch from the patient', () => {
    expect(source).toContain('IF NEW.branch_id IS NULL THEN');
    expect(source).toContain('NEW.branch_id := patient_branch_id;');
  });
  it('rejects cross-clinic and cross-branch referral writes', () => {
    expect(source).toContain("RAISE EXCEPTION 'referral patient belongs to another clinic'");
    expect(source).toContain("RAISE EXCEPTION 'referral branch does not match patient branch'");
    expect(source).toContain("RAISE EXCEPTION 'referral branch does not belong to clinic'");
  });
  it('keeps existing referrals aligned after a patient branch move', () => {
    expect(source).toContain('AFTER UPDATE OF branch_id');
    expect(source).toContain('SET branch_id = NEW.branch_id');
    expect(source).toContain('WHERE patient_id = NEW.id');
  });
});
