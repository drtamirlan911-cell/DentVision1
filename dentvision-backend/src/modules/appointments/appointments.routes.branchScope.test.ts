import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('appointment branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/appointments/appointments.routes.ts'), 'utf8');

  it('derives access from the authenticated branch memberships', () => {
    expect(source).toContain("req.user?.branchIds ?? []");
    expect(source).toContain("branchId: { in: branchIds }");
    expect(source).toContain("__NO_BRANCH_ACCESS__");
  });

  it('scopes appointment listing and conflict queries', () => {
    expect(source).toContain("const where: Record<string, unknown> = { clinicId, ...branchScope(req) }");
    expect(source).toContain("where: { clinicId, ...branchScope(req), date:");
  });

  it('scopes create, update, close, status and cancel by branch', () => {
    expect(source).toContain("where: { id, clinicId, ...branchScope(req) }");
    expect(source).toContain("where: { id: req.params.id as string, clinicId, ...branchScope(req) }");
    expect(source).toContain("clinicId, ...branchScope(req), status:");
    expect(source).toContain("branchId }, include: { patient");
  });

  it('does not allow a scoped user to create from a patient outside their branches', () => {
    expect(source).toContain("where: { id: patientId, clinicId, ...branchScope(req) }");
  });
});
