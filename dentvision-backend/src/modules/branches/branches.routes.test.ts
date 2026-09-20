import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('branch route authorization contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/branches/branches.routes.ts'), 'utf8');
  it('uses organization-aware branch persistence fields', () => {
    expect(source).toContain('organization_id'); expect(source).toContain('clinic_id'); expect(source).toContain('organizationId');
  });
  it('uses every universal branch assignment instead of only the first branch', () => {
    expect(source).toContain('req.user?.branchIds ?? []');
    expect(source).toContain('ANY');
    expect(source).not.toContain('branchIds ?? [])[0]');
  });
  it('routes mutations through the shared branch authorization layer', () => {
    expect(source).toContain("from '../../lib/branchAuthorization.js'");
    expect(source).toContain('authorizeMemberBranch'); expect(source).toContain('mutation = false');
  });
  it('keeps manager/assigned roles fail-closed for branch mutations', () => {
    expect(source).toContain("case 'MANAGER':"); expect(source).toContain("case 'DOCTOR':");
    expect(source).toContain("case 'ASSISTANT':");
    expect(source).toContain("if (mutation && !['OWNER', 'ADMIN'].includes(member.role))");
  });
  it('enforces partner branch subscription economics on organization creation', () => {
    expect(source).toContain('quoteBranchSubscription(organizationType, activeBranches + 1)');
    expect(source).toContain("code: 'BRANCH_PLAN_REQUIRED'");
  });

  it('does not silently expose every branch to scoped members', () => {
    expect(source).toContain("member.role} IN ('OWNER', 'ADMIN')");
    expect(source).toContain('member.branch_id ??');
  });
  it('returns userId for organization branch members so unassignment can target the same membership', () => {
    expect(source).toContain('p."userId" AS user_id');
    expect(source).toContain('userId:r.user_id');
  });

  it('prevents archiving the only active default branch', () => {
    expect(source).toContain("if (active === false && branch.is_default)");
    expect(source).toContain('Нельзя отключить единственный активный филиал');
  });

  it('exposes an authorization-gated branch workspace context endpoint', () => {
    expect(source).toContain("branchesRouter.post('/:id/workspace'");
    expect(source).toContain('context: { organizationId: branch.organization_id, clinicId: branch.clinic_id, branchId: branch.id }');
  });

  it('exposes explicit staff disable/enable semantics and active filtering', () => {
    expect(source).toContain("branchesRouter.patch('/:id/members/:userId/status'");
    expect(source).toContain("member_enabled");
    expect(source).toContain("member_disabled");
    expect(source).toContain('bm."active" = true');
    expect(source).toContain('updateMany({where:{personId:person.id,branchId},data:{active}})');
  });

});
