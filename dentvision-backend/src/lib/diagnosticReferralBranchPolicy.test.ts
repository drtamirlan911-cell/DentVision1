import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('diagnostic referral branch policy contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/diagnosticReferralBranchPolicy.ts'), 'utf8');

  it('requires the exact active clinic context and a trusted active branch allow-list', () => {
    expect(source).toContain('if (!resource.clinicId) return false');
    expect(source).toContain('if (!isActiveClinicContext(user, resource.clinicId)) return false');
    expect(source).toContain('[user.assignedBranchId, ...(user.branchIds ?? [])]');
    expect(source).toContain('if (!allowedBranchIds.has(resource.branchId)) return false');
    expect(source).toContain('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
    expect(source).toContain('organization_id = ${organizationId}');
    expect(source).toContain('organization_id IS NULL AND clinic_id = ${clinicId}');
    expect(source).toContain('AND active = true');
    expect(source).not.toContain('FROM "clinic_members" cm');
  });

  it('keeps organization roles explicit instead of introducing wildcard access', () => {
    expect(source).toContain("user.role === 'OWNER'");
    expect(source).toContain("user.role === 'ADMIN'");
    expect(source).not.toContain("user.role === '*'");
  });
});