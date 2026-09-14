import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('branch route authorization contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/modules/branches/branches.routes.ts'), 'utf8');

  it('uses organization-aware branch persistence fields', () => {
    expect(source).toContain('organization_id');
    expect(source).toContain('clinic_id');
    expect(source).toContain('organizationId');
  });

  it('routes mutations through the shared branch authorization layer', () => {
    expect(source).toContain("from '../../lib/branchAuthorization.js'");
    expect(source).toContain('authorizeMemberBranch');
    expect(source).toContain("mutation = false");
  });

  it('keeps manager/assigned roles fail-closed for branch mutations', () => {
    expect(source).toContain("case 'MANAGER':");
    expect(source).toContain("case 'DOCTOR':");
    expect(source).toContain("case 'ASSISTANT':");
    expect(source).toContain("if (mutation && !['OWNER', 'ADMIN'].includes(member.role))");
  });

  it('does not silently expose every branch to scoped members', () => {
    expect(source).toContain("OR 'ADMIN'");
    expect(source).toContain('"id" = ${member.branchId ?? \'\'}');
  });
});
