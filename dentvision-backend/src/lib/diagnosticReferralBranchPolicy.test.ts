import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('diagnostic referral branch policy contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/diagnosticReferralBranchPolicy.ts'), 'utf8');

  it('requires clinic membership and an assigned branch for scoped access', () => {
    expect(source).toContain('if (!resource.clinicId) return false');
    expect(source).toContain('WHERE "userId" = ${user.id} AND "clinicId" = ${resource.clinicId}');
    expect(source).toContain('if (!membership[0]) return false');
    expect(source).toContain('if (!resource.branchId) return false');
    expect(source).toContain('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
    expect(source).toContain('AND clinic_id = ${clinicId} AND active = true');
  });

  it('keeps organization roles explicit instead of introducing wildcard access', () => {
    expect(source).toContain("user.role === 'OWNER'");
    expect(source).toContain("user.role === 'ADMIN'");
    expect(source).not.toContain("user.role === '*'");
  });
});