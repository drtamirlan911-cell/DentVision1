import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(resolve(process.cwd(), 'dentvision-backend/prisma/migrations', name, 'migration.sql'), 'utf8');

describe('branch consistency migrations', () => {
  it('derives appointment branch from patient and rejects cross-clinic/cross-branch writes', () => {
    const sql = migration('20260914100000_enforce_branch_consistency');
    expect(sql).toContain('enforce_appointment_branch_consistency');
    expect(sql).toContain('IF NEW.branch_id IS NULL');
    expect(sql).toContain('NEW.branch_id := patient_branch_id');
    expect(sql).toContain('appointment patient belongs to another clinic');
    expect(sql).toContain('appointment branch does not match patient branch');
    expect(sql).toContain('appointment branch does not belong to clinic');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF "patientId", "clinicId", branch_id');
  });

  it('keeps appointments aligned after an authorized patient branch move', () => {
    const sql = migration('20260914101000_sync_appointment_branch_on_patient_move');
    expect(sql).toContain('sync_patient_appointment_branches');
    expect(sql).toContain('NEW.branch_id IS DISTINCT FROM OLD.branch_id');
    expect(sql).toContain('UPDATE appointments');
    expect(sql).toMatch(/WHERE\s+"patientId"\s*=\s*NEW\.?"?id"?/);
    expect(sql).toContain('AND "clinicId" = NEW."clinicId"');
  });
});

describe('PersonRole scoped identity migration', () => {
  it('replaces global person-role uniqueness with scope-aware uniqueness and preserves legacy organization ids', () => {
    const sql = migration('20260926120000_person_role_scope_key');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "scopeKey" TEXT NOT NULL DEFAULT \'platform\'');
    expect(sql).toContain('DROP INDEX IF EXISTS "person_roles_personId_roleId_key"');
    expect(sql).toContain('"scopeId" IS NOT NULL');
    expect(sql).toContain("'organization:' || "scopeId"");
    expect(sql).toContain('"personId", "roleId", "scopeKey"');
  });
});
