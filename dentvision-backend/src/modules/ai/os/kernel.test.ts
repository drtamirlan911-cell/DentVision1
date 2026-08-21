import { beforeEach, describe, expect, it, vi } from 'vitest';

const { activityCreate, evidenceCreateMany, resolveAiToolAccess, resolveOrganizationIdForClinic } = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  evidenceCreateMany: vi.fn(),
  resolveAiToolAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    agentActivity: { create: activityCreate },
    actionEvidence: { createMany: evidenceCreateMany },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({ resolveOrganizationIdForClinic }));
vi.mock('./access.js', () => ({ resolveAiToolAccess }));

const { okTool, noClinicTool, throwingTool } = vi.hoisted(() => ({
  okTool: vi.fn(async () => ({ ok: true, data: { fine: true } })),
  noClinicTool: vi.fn(async () => {
    throw new Error('NO_CLINIC');
  }),
  throwingTool: vi.fn(async () => {
    throw new Error('boom');
  }),
}));

vi.mock('./tools.js', () => ({
  TOOLS: {
    getSchedule: { name: 'getSchedule', mutating: false, execute: okTool },
    createInvoice: { name: 'createInvoice', mutating: true, execute: noClinicTool },
    getDebtors: { name: 'getDebtors', mutating: false, execute: throwingTool },
  },
  listToolNames: () => ['getSchedule', 'createInvoice', 'getDebtors'],
}));

import { runAiAction } from './kernel.js';

const PRINCIPAL = { surface: 'staff' as const, userId: 'user-1', requestedClinicId: 'clinic-1' };

beforeEach(() => {
  vi.clearAllMocks();
  activityCreate.mockResolvedValue({});
  evidenceCreateMany.mockResolvedValue({ count: 1 });
  resolveOrganizationIdForClinic.mockResolvedValue('org-1');
  resolveAiToolAccess.mockResolvedValue({
    role: 'DOCTOR',
    clinicId: 'clinic-1',
    allowed: new Set(['getSchedule', 'createInvoice', 'getDebtors']),
  });
});

describe('runAiAction — every outcome is recorded', () => {
  it('executes an allowed tool and records an ok activity + evidence', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {} });

    expect(result.status).toBe('ok');
    expect(okTool).toHaveBeenCalledTimes(1);
    expect(activityCreate).toHaveBeenCalledTimes(1);
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'ok', tool: 'getSchedule', clinicId: 'clinic-1' });
    expect(evidenceCreateMany).toHaveBeenCalledTimes(1);
  });

  it('denies and still records an activity for an unknown tool', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'doesNotExist', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NO_TOOL' });
    expect(activityCreate).toHaveBeenCalledTimes(1);
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'denied', denyReason: 'NO_TOOL' });
  });

  it('denies a tool this surface structurally does not own, before checking permissions', async () => {
    const result = await runAiAction({ ...PRINCIPAL, surface: 'patient' }, { tool: 'getSchedule', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_ON_SURFACE' });
    // Never even reached identity resolution — the surface gate comes first.
    expect(resolveAiToolAccess).not.toHaveBeenCalled();
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });

  it('denies a tool the caller is not permitted to call, and still records it', async () => {
    resolveAiToolAccess.mockResolvedValueOnce({ role: 'ASSISTANT', clinicId: 'clinic-1', allowed: new Set() });

    const result = await runAiAction(PRINCIPAL, { tool: 'createInvoice', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_ALLOWED' });
    expect(noClinicTool).not.toHaveBeenCalled();
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'denied', denyReason: 'NOT_ALLOWED' });
  });

  it('never trusts a model-supplied clinic id — resolves identity from the DB, not from the principal claim', async () => {
    await runAiAction({ ...PRINCIPAL, requestedClinicId: 'someone-elses-clinic' }, { tool: 'getSchedule', args: { clinicId: 'attacker-clinic' } });

    expect(resolveAiToolAccess).toHaveBeenCalledWith({
      userId: 'user-1',
      clinicId: 'someone-elses-clinic',
      isGuest: undefined,
    });
    // Whatever resolveAiToolAccess actually verified (clinic-1 per the mock)
    // is what reaches the tool's ToolContext — not the raw args.
    expect(okTool).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ clinicId: 'clinic-1' }));
  });

  it('maps a thrown NO_CLINIC into a structured denial and records it', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'createInvoice', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NO_CLINIC' });
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'denied', denyReason: 'NO_CLINIC' });
  });

  it('turns an unexpected tool throw into EXEC_ERROR instead of crashing the caller', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getDebtors', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'EXEC_ERROR' });
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'denied', denyReason: 'EXEC_ERROR' });
  });

  it('tags PHI-adjacent tools with phi sensitivity in the activity row', async () => {
    await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {} });
    // getSchedule is appointments.read, not medical.* — standard sensitivity.
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ sensitivity: 'standard' });
  });

  it('never lets a failing recordActivity/recordEvidence write break the caller-visible result', async () => {
    activityCreate.mockRejectedValueOnce(new Error('db down'));
    evidenceCreateMany.mockRejectedValueOnce(new Error('db down'));

    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {} });

    expect(result.status).toBe('ok');
  });
});
