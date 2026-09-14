import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const root = new URL('../prisma/migrations/', import.meta.url);

describe('branch consistency migration contracts', () => {
  it('uses PostgreSQL null-safe comparison for finance clinic boundaries', async () => {
    const source = await readFile(
      new URL('20260914141000_enforce_finance_branch_consistency/migration.sql', root),
      'utf8',
    );

    expect(source).toContain('branch_clinic_id IS DISTINCT FROM NEW.clinic_id');
    expect(source).toContain('BEFORE INSERT OR UPDATE OF clinic_id, branch_id');
    expect(source).toContain('invoices_branch_consistency');
    expect(source).toContain('expenses_branch_consistency');
  });

  it('uses null-safe comparison for referral patient and branch boundaries', async () => {
    const source = await readFile(
      new URL('20260914140000_enforce_referral_branch_consistency/migration.sql', root),
      'utf8',
    );

    expect(source).toContain('patient_clinic_id IS DISTINCT FROM NEW.clinic_id');
    expect(source).toContain('NEW.branch_id IS DISTINCT FROM patient_branch_id');
    expect(source).toContain('branch_clinic_id IS DISTINCT FROM NEW.clinic_id');
    expect(source).toContain('patients_sync_referral_branch');
  });
});
