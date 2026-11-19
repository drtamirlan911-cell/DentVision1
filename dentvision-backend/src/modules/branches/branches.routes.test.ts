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
    expect(source).toContain('SET "branch_id"=${branchId},"updatedAt"=CURRENT_TIMESTAMP');
    expect(source).toContain("if(!active && target.branchId !== branchId)");
    expect(source).toContain("BRANCH_MEMBER_ASSIGNED_ELSEWHERE");
  });

  it('keeps archived branches out of operational workspace and staff assignment', () => {
    expect(source).toContain("if (!branch.active) return res.status(409)");
    expect(source).toContain("code: 'BRANCH_ARCHIVED'");
    expect(source).toContain("if (active && !branch.active)");
    expect(source).toContain("if (!branch.active && !['OWNER', 'ADMIN'].includes(member.role))");
  });

  it('authorizes branch access before disclosing archive state', () => {
    const workspaceStart = source.indexOf("branchesRouter.post('/:id/workspace'");
    const workspaceEnd = source.indexOf("branchesRouter.get('/:id/members'", workspaceStart);
    const workspaceRoute = source.slice(workspaceStart, workspaceEnd);
    expect(workspaceRoute.indexOf('if (!authz.allowed)')).toBeLessThan(workspaceRoute.indexOf("code: 'BRANCH_ARCHIVED'"));

    const assignmentStart = source.indexOf("branchesRouter.post('/:id/members/:userId'");
    const assignmentEnd = source.indexOf("branchesRouter.patch('/:id/members/:userId/status'", assignmentStart);
    const assignmentRoute = source.slice(assignmentStart, assignmentEnd);
    expect(assignmentRoute.indexOf('if(!authz.allowed)')).toBeLessThan(assignmentRoute.indexOf('Нельзя назначать сотрудников в архивный филиал'));

    const statusStart = source.indexOf("branchesRouter.patch('/:id/members/:userId/status'");
    const statusEnd = source.indexOf("branchesRouter.delete('/:id/members/:userId'", statusStart);
    const statusRoute = source.slice(statusStart, statusEnd);
    expect(statusRoute.indexOf('if(!authz.allowed)')).toBeLessThan(statusRoute.indexOf('Нельзя включить сотрудника в архивном филиале'));
  });


  it('authorizes a caller before disclosing the archived state of an organization branch', () => {
    const workspace = source.slice(
      source.indexOf("branchesRouter.post('/:id/workspace'"),
      source.indexOf("branchesRouter.get('/:id/members'"),
    );
    expect(workspace.indexOf('if (!authz.allowed)')).toBeGreaterThanOrEqual(0);
    expect(workspace.indexOf('if (!branch.active)')).toBeGreaterThan(workspace.indexOf('if (!authz.allowed)'));

    const assignment = source.slice(
      source.indexOf("branchesRouter.post('/:id/members/:userId'"),
      source.indexOf("branchesRouter.patch('/:id/members/:userId/status'"),
    );
    const authorizationIndex = Math.max(
      assignment.indexOf('if(!authz.allowed)'),
      assignment.indexOf('if (!authz.allowed)'),
    );
    expect(authorizationIndex).toBeGreaterThanOrEqual(0);
    expect(assignment.indexOf('BRANCH_ARCHIVED')).toBeGreaterThan(authorizationIndex);
  });

});
