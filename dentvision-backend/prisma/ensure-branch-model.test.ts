import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ensure-branch-model bootstrap contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/prisma/ensure-branch-model.ts'), 'utf8');

  it('targets Organization as the Branch owner', () => {
    expect(source).toContain('organizationId');
    expect(source).toContain('organization Organization? @relation');
    expect(source).toContain('OrganizationInvitation[]');
  });
  it('keeps clinic linkage transitional and nullable', () => {
    expect(source).toContain('clinicId       String?      @map("clinic_id")');
    expect(source).toContain('clinic       Clinic?');
    expect(source).toContain('onDelete: SetNull');
  });
  it('assigns ClinicMember records to an optional branch', () => {
    expect(source).toContain('branchId           String?');
    expect(source).toContain('branch Branch? @relation(fields: [branchId]');
  });
  it('introduces nullable branch scope for Patient and Appointment', () => {
    expect(source).toContain("ensureScalarField('Patient'");
    expect(source).toContain("ensureScalarField('Appointment'");
    expect(source).toContain('branchId       String?');
    expect(source).toContain('branchId        String?');
  });
  it('covers operational models with tolerant clinicId insertion', () => {
    expect(source).toContain("ensureScalarField('InventoryItem'");
    expect(source).toContain("ensureScalarField('Invoice'");
    expect(source).toContain("ensureScalarField('Expense'");
    expect(source).toContain("ensureScalarField('Referral'");
    expect(source).toContain('const clinicField = /(^|\\n)\\s*clinicId\\s+String');
  });
  it('fails clearly when a model has no usable clinicId field', () => {
    expect(source).toContain('clinicId marker not found');
  });
  it('enforces organization/code uniqueness and branch indexes', () => {
    expect(source).toContain('@@unique([organizationId, code])');
    expect(source).toContain('@@index([organizationId, active])');
  });
});
