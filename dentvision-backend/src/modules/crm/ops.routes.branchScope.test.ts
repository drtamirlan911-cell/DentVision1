import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CRM operations selected-branch authorization contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/crm/ops.routes.ts'),
    'utf8',
  );

  it('resolves operational scope from active clinic IAM, not JWT branch arrays', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('await resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: req.user?.organizationId');
    expect(source).toContain('requestedBranchId: requestedBranchId ?? req.user?.branchId');
    expect(source).not.toContain('req.user?.branchIds');
    expect(source).toContain("access.roleScope === 'ORGANIZATION' && access.branchId === null");
  });

  it('restricts waiting-list records to the persisted selected branch', () => {
    expect(source).toContain('function waitingListScopeWhere(context: OpsBranchContext, clinicId: string)');
    expect(source).toContain('return context.organizationWide');
    expect(source).toContain('{ clinicId, branchId: context.branchId }');
    expect(source).toContain("if (!canManageWaitingListPatient(branchContext, patientId))");
    expect(source).toContain("if (!canManageWaitingListPatient(branchContext, nextPatientId))");
    expect(source).toContain('branchId: branchContext.organizationWide && b.branchId === undefined');
    expect(source).toContain('where: waitingListScopeWhere(branchContext, clinicId)');
    expect(source).toContain('deleteMany({ where: { id, ...waitingListScopeWhere(branchContext, clinicId) } })');
    expect(source).toContain('await getPatientIdsForBranchScope(clinicId, branchIds)');
  });

  it('scopes expense listing, updates, and deletion to the selected branch', () => {
    expect(source).toContain('function expenseScopeWhere(context: OpsBranchContext, clinicId: string)');
    expect(source).toContain('return context.organizationWide ? { clinicId } : { clinicId, branchId: context.branchId }');
    expect(source).toContain('where: { id, ...expenseScopeWhere(branchContext, clinicId) }');
    expect(source).toContain('deleteMany({ where: { id, ...expenseScopeWhere(branchContext, clinicId) } })');
    expect(source).toContain('branchId: branchContext.branchId');
  });

  it('does not delete globally owned idempotency keys on cross-scope replay conflicts', () => {
    const replayStart = source.indexOf("if (reserved.status === 'exists')");
    const createStart = source.indexOf('const id = b.id || uid();', replayStart);
    expect(replayStart).toBeGreaterThanOrEqual(0);
    expect(createStart).toBeGreaterThan(replayStart);
    const replay = source.slice(replayStart, createStart);
    expect(replay).toContain("code: 'IDEMPOTENCY_KEY_SCOPE_CONFLICT'");
    expect(replay).toContain('where: { id: reserved.resultId, ...expenseScopeWhere(replayScope, clinicId) }');
    expect(replay).not.toContain('deleteIdempotencyKey');
  });

  it('uses persisted booking branch keys for list, upsert, confirm and cancellation', () => {
    expect(source).toContain('function bookingScopeWhere(context: BookingBranchContext, clinicId: string)');
    expect(source).toContain('return context.organizationWide ? { clinicId } : { clinicId, branchId: context.branchId }');
    expect(source).toContain('const bookingBranchId = await resolveBookingBranchId(');
    expect(source).toContain('branchId: bookingBranchId');
    expect(source).toContain('branchId: appointmentBranchId');
    expect(source).toContain('branchId: context.branchId');
    expect(source).toContain('await resolveBookingBranchId(');
    expect(source).toContain('where: { id, ...bookingScopeWhere(branchContext, clinicId) }');
    expect(source).toContain("data: { status: 'cancelled' }");
  });
});
