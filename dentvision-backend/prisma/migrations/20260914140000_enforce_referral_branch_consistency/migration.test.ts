import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const migration = new URL('./migration.sql', import.meta.url);

describe('referral branch consistency migration', () => {
  it('inherits a missing referral branch from the patient', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain('IF NEW.branch_id IS NULL THEN');
    expect(source).toContain('NEW.branch_id := patient_branch_id;');
  });

  it('rejects cross-clinic and cross-branch referral writes', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain("RAISE EXCEPTION 'referral patient belongs to another clinic'");
    expect(source).toContain("RAISE EXCEPTION 'referral branch does not match patient branch'");
    expect(source).toContain("RAISE EXCEPTION 'referral branch does not belong to clinic'");
  });

  it('keeps existing referrals aligned after a patient branch move', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain('AFTER UPDATE OF branch_id');
    expect(source).toContain('SET branch_id = NEW.branch_id');
    expect(source).toContain('WHERE patient_id = NEW.id');
  });
});
