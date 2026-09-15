import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'dentvision-backend/prisma/migrations');

describe('branch consistency migration contracts', () => {
  it('uses PostgreSQL null-safe comparison for finance clinic boundaries', () => {
    const source = readFileSync(resolve(root, '20260914141000_enforce_finance_branch_consistency/migration.sql'), 'utf8');
    expect(source).toContain('branch_clinic_id IS DISTINCT FROM NEW."clinicId"');
    expect(source).toContain('BEFORE INSERT OR UPDATE OF "clinicId", "branch_id"');
    expect(source).toContain('invoices_branch_consistency');
    expect(source).toContain('expenses_branch_consistency');
    expect(source).toContain('b."isDefault" = true');
    expect(source).toContain('b."createdAt" ASC');
  });

  it('uses null-safe comparison for referral patient and branch boundaries', () => {
    const source = readFileSync(resolve(root, '20260914140000_enforce_referral_branch_consistency/migration.sql'), 'utf8');
    expect(source).toContain('patient_clinic_id IS DISTINCT FROM NEW."clinicId"');
    expect(source).toContain('NEW."branch_id" IS DISTINCT FROM patient_branch_id');
    expect(source).toContain('branch_clinic_id IS DISTINCT FROM NEW."clinicId"');
    expect(source).toContain('WHERE "patientId" = NEW.id');
    expect(source).toContain('AND "clinicId" = NEW."clinicId"');
    expect(source).toContain('patients_sync_referral_branch');
    expect(source).not.toContain('p.clinic_id');
    expect(source).not.toContain('NEW.clinic_id');
  });
});
