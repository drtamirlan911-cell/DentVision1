import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  activityCreate,
  evidenceCreateMany,
  resolveAiToolAccess,
  resolveOrganizationIdForClinic,
  approvalCreate,
  approvalFindUnique,
  createNotificationForClinic,
} = vi.hoisted(() => ({
  activityCreate: vi.fn(),
  evidenceCreateMany: vi.fn(),
  resolveAiToolAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  approvalCreate: vi.fn(),
  approvalFindUnique: vi.fn(),
  createNotificationForClinic: vi.fn(),
}));

const { patientExecute, adminExecuteToolCall, aiAdminSessionFindUnique, patientAssignmentFindFirst, mockEnv } = vi.hoisted(() => ({
  patientExecute: vi.fn(),
  adminExecuteToolCall: vi.fn(),
  aiAdminSessionFindUnique: vi.fn(),
  patientAssignmentFindFirst: vi.fn(),
  mockEnv: { AI_PATIENT_SCOPE: 'off' as 'on' | 'off' },
}));

vi.mock('../../../config.js', () => ({ env: mockEnv }));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    agentActivity: { create: activityCreate },
    actionEvidence: { createMany: evidenceCreateMany },
    aiApproval: { create: approvalCreate, findUnique: approvalFindUnique },
    aiAdminSession: { findUnique: aiAdminSessionFindUnique },
    patientAssignment: { findFirst: patientAssignmentFindFirst },
  },
}));
vi.mock('../../../lib/orgContext.js', () => ({ resolveOrganizationIdForClinic }));
vi.mock('./access.js', () => ({ resolveAiToolAccess }));
vi.mock('../../../services/notification.service.js', () => ({ createNotificationForClinic }));
vi.mock('../../ai-patient/patientTools.js', () => ({
  executePatientTool: patientExecute,
  listPatientToolNames: () => ['getMyAppointments', 'cancelMyAppointment'],
  FORBIDDEN_PARAM_NAMES: ['patientid', 'patient_id', 'patient', 'userid', 'user_id', 'clinicid', 'clinic_id', 'iin', 'phone', 'email'],
}));
vi.mock('../../ai-admin/llm/tools/tools.registry.js', () => ({
  executeToolCall: adminExecuteToolCall,
  toolsRegistry: [{ name: 'get_available_slots' }, { name: 'book_appointment' }, { name: 'escalate_to_human' }],
}));

const { okTool, noClinicTool, throwingTool, cancelTool, patientCardTool } = vi.hoisted(() => ({
  okTool: vi.fn(async () => ({ ok: true, data: { fine: true } })),
  noClinicTool: vi.fn(async () => {
    throw new Error('NO_CLINIC');
  }),
  throwingTool: vi.fn(async () => {
    throw new Error('boom');
  }),
  cancelTool: vi.fn(async () => ({ ok: true, data: { cancelled: true } })),
  patientCardTool: vi.fn(async () => ({ ok: true, data: { name: 'Patient' } })),
}));

vi.mock('./tools.js', () => ({
  TOOLS: {
    getSchedule: { name: 'getSchedule', mutating: false, execute: okTool },
    createInvoice: { name: 'createInvoice', mutating: true, execute: noClinicTool },
    getDebtors: { name: 'getDebtors', mutating: false, execute: throwingTool },
    cancelAppointment: { name: 'cancelAppointment', mutating: true, execute: cancelTool },
    getPatientCard: { name: 'getPatientCard', mutating: false, execute: patientCardTool },
  },
  listToolNames: () => ['getSchedule', 'createInvoice', 'getDebtors', 'cancelAppointment', 'getPatientCard'],
}));

import { runAiAction } from './kernel.js';

const PRINCIPAL = { surface: 'staff' as const, userId: 'user-1', requestedClinicId: 'clinic-1' };

beforeEach(() => {
  vi.clearAllMocks();
  activityCreate.mockResolvedValue({});
  evidenceCreateMany.mockResolvedValue({ count: 1 });
  resolveOrganizationIdForClinic.mockResolvedValue('org-1');
  patientExecute.mockResolvedValue({ appointments: [] });
  adminExecuteToolCall.mockResolvedValue({ slots: [] });
  aiAdminSessionFindUnique.mockResolvedValue({ id: 'session-1', clinicId: 'clinic-1', channel: 'whatsapp' });
  resolveAiToolAccess.mockResolvedValue({
    role: 'DOCTOR',
    clinicId: 'clinic-1',
    allowed: new Set(['getSchedule', 'createInvoice', 'getDebtors', 'cancelAppointment', 'getPatientCard']),
  });
  approvalCreate.mockResolvedValue({});
  approvalFindUnique.mockResolvedValue(null);
  createNotificationForClinic.mockResolvedValue(undefined);
  patientAssignmentFindFirst.mockResolvedValue(null);
  mockEnv.AI_PATIENT_SCOPE = 'off';
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

  it('passes `confirmed: true` through to a staff-surface tool instead of stripping it — orchestrator.ts already stripped it for model proposals at its own call site', async () => {
    await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: { confirmed: true, foo: 'bar' } });

    expect(okTool).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: true, foo: 'bar' }),
      expect.anything(),
    );
  });
});

describe('runAiAction — high-risk approval gate', () => {
  it('does not gate a high-risk tool on its first, unconfirmed proposal — the tool returns its own soft preview', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'cancelAppointment', args: { appointmentId: 'a1' } });

    expect(result.status).toBe('ok');
    expect(cancelTool).toHaveBeenCalledTimes(1);
    expect(approvalCreate).not.toHaveBeenCalled();
  });

  it('creates a durable approval instead of executing when a high-risk tool is actually confirmed', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'cancelAppointment', args: { appointmentId: 'a1', confirmed: true } });

    expect(result.status).toBe('pending_approval');
    expect(cancelTool).not.toHaveBeenCalled();
    expect(approvalCreate).toHaveBeenCalledTimes(1);
    expect(approvalCreate.mock.calls[0][0].data).toMatchObject({
      tool: 'cancelAppointment',
      requestedByUserId: 'user-1',
      clinicId: 'clinic-1',
      riskLevel: 'high',
      status: 'pending',
    });
    expect(createNotificationForClinic).toHaveBeenCalledWith(
      'clinic-1',
      expect.objectContaining({ type: 'ai_approval_requested' }),
      { roles: ['OWNER', 'DIRECTOR', 'ADMIN'] },
    );
    // The gate itself is still recorded, distinctly from a denial.
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ status: 'pending_approval' });
  });

  it('executes once re-entered with a reference to a genuinely approved row', async () => {
    approvalFindUnique.mockResolvedValueOnce({
      id: 'appr-1', status: 'approved', tool: 'cancelAppointment', clinicId: 'clinic-1',
    });

    const result = await runAiAction(PRINCIPAL, {
      tool: 'cancelAppointment',
      args: { appointmentId: 'a1', confirmed: true },
      approvalId: 'appr-1',
    });

    expect(result.status).toBe('ok');
    expect(cancelTool).toHaveBeenCalledTimes(1);
    expect(approvalCreate).not.toHaveBeenCalled();
  });

  it('refuses to execute on an approvalId that does not resolve to an approved row for this tool and clinic', async () => {
    approvalFindUnique.mockResolvedValueOnce({
      id: 'appr-1', status: 'pending', tool: 'cancelAppointment', clinicId: 'clinic-1',
    });

    const result = await runAiAction(PRINCIPAL, {
      tool: 'cancelAppointment',
      args: { appointmentId: 'a1', confirmed: true },
      approvalId: 'appr-1',
    });

    expect(result).toMatchObject({ status: 'denied', reason: 'INVALID_APPROVAL' });
    expect(cancelTool).not.toHaveBeenCalled();
  });

  it('does not gate a tool outside HIGH_RISK_TOOLS at all — confirm still executes immediately', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: { confirmed: true } });
    expect(result.status).toBe('ok');
    expect(approvalCreate).not.toHaveBeenCalled();
  });
});

describe('runAiAction — patient surface', () => {
  const PATIENT_PRINCIPAL = { surface: 'patient' as const, userId: 'portal-user-1', requestedClinicId: 'clinic-1', patientId: 'patient-1' };

  it('dispatches to executePatientTool with a patient-shaped context, not the staff ToolContext', async () => {
    const result = await runAiAction(PATIENT_PRINCIPAL, { tool: 'getMyAppointments', args: {} });

    expect(result.status).toBe('ok');
    expect(patientExecute).toHaveBeenCalledWith(
      'getMyAppointments',
      {},
      { userId: 'portal-user-1', patientId: 'patient-1', clinicId: 'clinic-1' },
    );
    // No staff identity/permission resolution for this surface at all.
    expect(resolveAiToolAccess).not.toHaveBeenCalled();
    expect(activityCreate.mock.calls[0][0].data).toMatchObject({ actorRole: 'PATIENT', patientId: 'patient-1' });
  });

  it('refuses a staff-only tool from the patient surface — the surface gate, not a permission check', async () => {
    const result = await runAiAction(PATIENT_PRINCIPAL, { tool: 'getSchedule', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_ON_SURFACE' });
    expect(patientExecute).not.toHaveBeenCalled();
  });

  it('maps a thrown NO_CLINIC from a patient tool the same way as the staff path', async () => {
    patientExecute.mockRejectedValueOnce(new Error('NO_CLINIC'));

    const result = await runAiAction(PATIENT_PRINCIPAL, { tool: 'cancelMyAppointment', args: { appointmentId: 'a1' } });

    expect(result).toMatchObject({ status: 'denied', reason: 'NO_CLINIC' });
  });
});

describe('runAiAction — admin surface', () => {
  const ADMIN_PRINCIPAL = { surface: 'admin' as const, userId: 'system:ai-admin:session-1', requestedClinicId: 'clinic-1', sessionId: 'session-1' };

  it('resolves the AiAdminSession row and reuses executeToolCall as-is (the function Stage 1 hardened)', async () => {
    const result = await runAiAction(ADMIN_PRINCIPAL, { tool: 'get_available_slots', args: { service_name: 'чистка' } });

    expect(result.status).toBe('ok');
    expect(aiAdminSessionFindUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    expect(adminExecuteToolCall).toHaveBeenCalledWith(
      'get_available_slots',
      { service_name: 'чистка' },
      expect.objectContaining({ id: 'session-1' }),
    );
    expect(resolveAiToolAccess).not.toHaveBeenCalled();
  });

  it('denies with NO_CLINIC when the session id does not resolve to a real session', async () => {
    aiAdminSessionFindUnique.mockResolvedValueOnce(null);

    const result = await runAiAction(ADMIN_PRINCIPAL, { tool: 'book_appointment', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NO_CLINIC' });
    expect(adminExecuteToolCall).not.toHaveBeenCalled();
  });

  it('refuses a patient-only tool from the admin surface', async () => {
    const result = await runAiAction(ADMIN_PRINCIPAL, { tool: 'getMyAppointments', args: {} });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_ON_SURFACE' });
  });
});

describe('runAiAction — patient scope (env.AI_PATIENT_SCOPE)', () => {
  it('is a no-op while the flag is off, even for a DOCTOR calling a single-patient tool', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: { patientId: 'p-other' } });

    expect(result.status).toBe('ok');
    expect(patientAssignmentFindFirst).not.toHaveBeenCalled();
  });

  it('denies OUT_OF_PATIENT_SCOPE when the flag is on and the DOCTOR has no assignment to this patient', async () => {
    mockEnv.AI_PATIENT_SCOPE = 'on';
    patientAssignmentFindFirst.mockResolvedValueOnce(null);

    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: { patientId: 'p-other' } });

    expect(result).toMatchObject({ status: 'denied', reason: 'OUT_OF_PATIENT_SCOPE' });
    expect(patientCardTool).not.toHaveBeenCalled();
    expect(patientAssignmentFindFirst).toHaveBeenCalledWith({
      where: { patientId: 'p-other', userId: 'user-1', active: true },
      select: { id: true },
    });
  });

  it('executes when the flag is on and the DOCTOR is actually assigned to this patient', async () => {
    mockEnv.AI_PATIENT_SCOPE = 'on';
    patientAssignmentFindFirst.mockResolvedValueOnce({ id: 'pa-1' });

    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: { patientId: 'p-mine' } });

    expect(result.status).toBe('ok');
    expect(patientCardTool).toHaveBeenCalledTimes(1);
  });

  it('does not gate a tool with an optional patientId (getVisits-style) even when the flag is on — known, documented boundary', async () => {
    mockEnv.AI_PATIENT_SCOPE = 'on';

    // getSchedule carries no entry in TOOL_PATIENT_ARG at all.
    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {} });

    expect(result.status).toBe('ok');
    expect(patientAssignmentFindFirst).not.toHaveBeenCalled();
  });

  it('does not gate roles outside DOCTOR/ASSISTANT even when the flag is on', async () => {
    mockEnv.AI_PATIENT_SCOPE = 'on';
    resolveAiToolAccess.mockResolvedValueOnce({
      role: 'OWNER',
      clinicId: 'clinic-1',
      allowed: new Set(['getPatientCard']),
    });

    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: { patientId: 'p-any' } });

    expect(result.status).toBe('ok');
    expect(patientAssignmentFindFirst).not.toHaveBeenCalled();
  });

  it('never applies to the patient or admin surface (no such role there)', async () => {
    mockEnv.AI_PATIENT_SCOPE = 'on';

    const result = await runAiAction(
      { surface: 'patient', userId: 'portal-user-1', requestedClinicId: 'clinic-1', patientId: 'patient-1' },
      { tool: 'getMyAppointments', args: {} },
    );

    expect(result.status).toBe('ok');
    expect(patientAssignmentFindFirst).not.toHaveBeenCalled();
  });
});

describe('runAiAction — skill boundary (inv.skillId)', () => {
  it('executes when the tool belongs to the named skill and the caller satisfies its requiredPermission', async () => {
    // 'patient-summary' = { tools: [getPatientCard, getVisits], requiredPermission: 'medical.read' }.
    // getPatientCard maps to medical.read in the real TOOL_PERMISSIONS, and it's in the mocked allowed set.
    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: {}, skillId: 'patient-summary' });

    expect(result.status).toBe('ok');
    expect(patientCardTool).toHaveBeenCalledTimes(1);
  });

  it('denies NOT_IN_SKILL when the tool is not part of the named skill', async () => {
    // 'patient-summary' does not include getSchedule.
    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {}, skillId: 'patient-summary' });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_IN_SKILL' });
    expect(okTool).not.toHaveBeenCalled();
  });

  it('denies NOT_IN_SKILL for an unknown skillId', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: {}, skillId: 'no-such-skill' });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_IN_SKILL' });
    expect(patientCardTool).not.toHaveBeenCalled();
  });

  it('denies NOT_IN_SKILL when the caller does not satisfy the skill requiredPermission, even though the tool itself is allowed', async () => {
    // Caller may call getSchedule directly (appointments.read), but 'appointment-booking'
    // requires appointments.write across the whole skill — no allowed tool carries that permission here.
    resolveAiToolAccess.mockResolvedValueOnce({
      role: 'ASSISTANT',
      clinicId: 'clinic-1',
      allowed: new Set(['getSchedule']),
    });

    const result = await runAiAction(PRINCIPAL, { tool: 'getSchedule', args: {}, skillId: 'appointment-booking' });

    expect(result).toMatchObject({ status: 'denied', reason: 'NOT_IN_SKILL' });
    expect(okTool).not.toHaveBeenCalled();
  });

  it('is unaffected when no skillId is set (existing per-tool gate alone decides)', async () => {
    const result = await runAiAction(PRINCIPAL, { tool: 'getPatientCard', args: {} });

    expect(result.status).toBe('ok');
  });
});
