import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'prisma', 'migrations', name, 'migration.sql'), 'utf8');

describe('branch consistency migrations', () => {
  it('derives appointment branch from patient and rejects cross-clinic/cross-branch writes', () => {
    const sql = migration('20260914100000_enforce_branch_consistency');
    expect(sql).toContain('enforce_appointment_branch_consistency');
    expect(sql).toContain('IF NEW.branch_id IS NULL');
    expect(sql).toContain('NEW.branch_id := patient_branch_id');
    expect(sql).toContain("appointment patient belongs to another clinic");
    expect(sql).toContain("appointment branch does not match patient branch");
    expect(sql).toContain("appointment branch does not belong to clinic");
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF patient_id, clinic_id, branch_id');
  });

  it('keeps appointments aligned after an authorized patient branch move', () => {
    const sql = migration('20260914101000_sync_appointment_branch_on_patient_move');
    expect(sql).toContain('sync_patient_appointment_branches');
    expect(sql).toContain('NEW.branch_id IS DISTINCT FROM OLD.branch_id');
    expect(sql).toContain('UPDATE appointments');
    expect(sql).toContain('WHERE patient_id = NEW.id');
  });
});
