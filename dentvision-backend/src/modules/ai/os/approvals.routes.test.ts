import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindUnique, approvalFindMany, approvalFindUnique, approvalUpdate,
  resolveClinicAccess, resolveOrganizationIdForClinic, resolveUserPermissions,
  assertSameClinic, resolveAiToolAccess, runAiAction, auditFromReq,
  listAiEmployeeTasks, transitionAiEmployeeTask,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(), approvalFindMany: vi.fn(), approvalFindUnique: vi.fn(), approvalUpdate: vi.fn(),
  resolveClinicAccess: vi.fn(), resolveOrganizationIdForClinic: vi.fn(), resolveUserPermissions: vi.fn(),
  assertSameClinic: vi.fn(), resolveAiToolAccess: vi.fn(), runAiAction: vi.fn(), auditFromReq: vi.fn(),
  listAiEmployeeTasks: vi.fn(), transitionAiEmployeeTask: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    aiApproval: { findMany: approvalFindMany, findUnique: approvalFindUnique, update: approvalUpdate },
  },
}));
vi.mock('../../../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../lib/clinicAccess.js', () => ({ assertSameClinic }));
vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess, resolveOrganizationIdForClinic }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));
vi.mock('../../compliance/audit.service.js', () => ({ auditFromReq }));
vi.mock('./access.js', () => ({ resolveAiToolAccess }));
vi.mock('./kernel.js', () => ({ runAiAction }));
vi.mock('./aiEmployeeTasks.js', () => ({ listAiEmployeeTasks, transitionAiEmployeeTask }));

import router from './approvals.routes.js';
import { decryptAiApprovalDecisionNote, encryptAiApprovalDecisionNote, encryptAiApprovalParams } from './approvalPrivacy.js';

function routeHandler(method: 'get' | 'post', path: string): (req: any, res: any, next?: any) => Promise<void> {
  const layer = (router as any).stack.find((entry: any) =>
    entry.route?.path === path && entry.route?.methods?.[method],
  );
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function responseHarness() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}

const caller = { id: 'approver-1', clinicId: 'clinic-1', role: 'MANAGER', isGuest: false };

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ role: 'MANAGER' });
  resolveClinicAccess.mockResolvedValue({ role: 'MANAGER' });
  resolveOrganizationIdForClinic.mockResolvedValue('org-1');
  resolveUserPermissions.mockResolvedValue(['bi.read']);
  approvalFindMany.mockResolvedValue([]);
  approvalFindUnique.mockResolvedValue(null);
  approvalUpdate.mockResolvedValue({});
  assertSameClinic.mockReturnValue(true);
  resolveAiToolAccess.mockResolvedValue({ allowed: new Set(['cancelAppointment']) });
  runAiAction.mockResolvedValue({ status: 'ok', activityId: 'activity-1' });
  auditFromReq.mockResolvedValue(undefined);
  listAiEmployeeTasks.mockResolvedValue([]);
  transitionAiEmployeeTask.mockResolvedValue(null);
});

describe('Approval Center PHI API boundary', () => {
  it('masks clinical params, legacy summaries and decision notes without medical.read', async () => {
    approvalFindMany.mockResolvedValueOnce([{
      id: 'approval-1', clinicId: 'clinic-1', requestedByUserId: 'requester-1',
      tool: 'createTreatmentPlan',
      params: encryptAiApprovalParams({ patientId: 'patient-phi-1', title: 'Sensitive plan' }),
      summary: 'Legacy summary for patient-phi-1',
      decisionNote: encryptAiApprovalDecisionNote('Patient-specific clinical note'),
      status: 'pending',
    }]);
    const res = responseHarness();
    await routeHandler('get', '/')({ user: caller, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].params).toEqual({});
    expect(res.body.data[0].summary).toBe('Требуется подтверждение: создание плана лечения');
    expect(res.body.data[0].decisionNote).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('Patient-specific clinical note');
    expect(JSON.stringify(res.body)).not.toContain('patient-phi-1');
  });

  it('decrypts payloads only for callers with medical.read', async () => {
    resolveUserPermissions.mockResolvedValueOnce(['bi.read', 'medical.read']);
    const params = { patientId: 'patient-phi-2', title: 'Authorized plan' };
    approvalFindMany.mockResolvedValueOnce([{
      id: 'approval-2', clinicId: 'clinic-1', requestedByUserId: 'requester-1',
      tool: 'createTreatmentPlan', params: encryptAiApprovalParams(params),
      summary: 'Legacy summary that must be replaced',
      decisionNote: encryptAiApprovalDecisionNote('Authorized note'), status: 'pending',
    }]);
    const res = responseHarness();
    await routeHandler('get', '/')({ user: caller, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].params).toEqual(params);
    expect(res.body.data[0].decisionNote).toBe('Authorized note');
    expect(res.body.data[0].summary).toBe('Требуется подтверждение: создание плана лечения');
  });

  it('keeps the invoice amount while hiding patient id and free-form description', async () => {
    approvalFindMany.mockResolvedValueOnce([{
      id: 'approval-3', tool: 'createInvoice',
      params: encryptAiApprovalParams({ patientId: 'patient-phi-3', amount: 145000, description: 'Sensitive detail' }),
      summary: 'Invoice for patient-phi-3', decisionNote: null, status: 'pending',
    }]);
    const res = responseHarness();
    await routeHandler('get', '/')({ user: caller, query: {} }, res);
    expect(res.body.data[0].params).toEqual({ amount: 145000 });
    expect(JSON.stringify(res.body)).not.toContain('patient-phi-3');
    expect(JSON.stringify(res.body)).not.toContain('Sensitive detail');
  });

  it('decrypts params only after clinic and tool authorization, then executes the approved action', async () => {
    const params = { appointmentId: 'appointment-1', reason: 'Private cancellation reason', confirmed: true };
    approvalFindUnique.mockResolvedValueOnce({
      id: 'approval-4', clinicId: 'clinic-1', requestedByUserId: 'requester-2', surface: 'staff',
      tool: 'cancelAppointment', params: encryptAiApprovalParams(params), riskLevel: 'high',
      status: 'pending', expiresAt: new Date(Date.now() + 60_000),
    });
    const res = responseHarness();
    await routeHandler('post', '/:id/approve')({
      user: caller, params: { id: 'approval-4' }, body: { note: 'Approval note with private content' },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(runAiAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'requester-2', requestedClinicId: 'clinic-1' }),
      { tool: 'cancelAppointment', args: params, approvalId: 'approval-4' },
    );
    const firstUpdate = approvalUpdate.mock.calls[0][0].data;
    expect(firstUpdate.decisionNote).toMatch(/^ENC:/);
    expect(firstUpdate.decisionNote).not.toContain('Approval note with private content');
    expect(decryptAiApprovalDecisionNote(firstUpdate.decisionNote)).toBe('Approval note with private content');
  });

  it('does not decrypt or execute params when the approver lacks tool permission', async () => {
    approvalFindUnique.mockResolvedValueOnce({
      id: 'approval-5', clinicId: 'clinic-1', requestedByUserId: 'requester-3', surface: 'staff',
      tool: 'cancelAppointment', params: 'ENC:invalid', riskLevel: 'high', status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });
    resolveAiToolAccess.mockResolvedValueOnce({ allowed: new Set() });
    const res = responseHarness();
    await routeHandler('post', '/:id/approve')({
      user: caller, params: { id: 'approval-5' }, body: {},
    }, res);
    expect(res.statusCode).toBe(403);
    expect(runAiAction).not.toHaveBeenCalled();
    expect(approvalUpdate).not.toHaveBeenCalled();
  });
});
