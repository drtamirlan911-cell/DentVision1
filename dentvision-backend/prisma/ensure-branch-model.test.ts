import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('canonical branch schema contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/prisma/schema.prisma'), 'utf8');

  it('targets Organization as the Branch owner', () => {
    expect(source).toContain('model Branch {');
    expect(source).toContain('organizationId String');
    expect(source).toContain('organization Organization @relation');
  });

  it('keeps clinic linkage transitional and nullable', () => {
    expect(source).toContain('clinicId String? @map("clinic_id")');
    expect(source).toContain('clinic Clinic? @relation');
    expect(source).toContain('onDelete: SetNull');
  });

  it('assigns ClinicMember records to an optional branch', () => {
    expect(source).toContain('branchId String? @map("branch_id")');
    expect(source).toContain('branch Branch? @relation');
  });

  it('introduces nullable branch scope for Patient and Appointment', () => {
    expect(source).toMatch(/model Patient \{[\s\S]*?branchId String\?/);
    expect(source).toMatch(/model Appointment \{[\s\S]*?branchId String\?/);
  });

  it('covers operational models with branch scope', () => {
    for (const model of ['InventoryItem', 'Invoice', 'Expense', 'Referral']) {
      expect(source).toContain(`model ${model} {`);
    }
    expect(source).toContain('branchId String?');
  });

  it('keeps the bootstrap command non-mutating and schema-driven', () => {
    const bootstrap = readFileSync(resolve(process.cwd(), 'dentvision-backend/prisma/ensure-branch-model.ts'), 'utf8');
    expect(bootstrap).toContain('canonical branch schema verified');
    expect(bootstrap).not.toContain('writeFileSync');
  });

  it('enforces organization/code uniqueness and branch indexes', () => {
    expect(source).toContain('@@unique([organizationId, code])');
    expect(source).toContain('@@index([organizationId, active])');
  });
});
