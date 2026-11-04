import { beforeEach, describe, expect, it, vi } from 'vitest';

const { logAIAction, escalateToClinic } = vi.hoisted(() => ({
  logAIAction: vi.fn(),
  escalateToClinic: vi.fn(),
}));

vi.mock('../compliance/compliance.service.js', () => ({ logAIAction }));
vi.mock('./escalation.service.js', () => ({ escalateToClinic }));

import { PATIENT_TOOLS } from './patientTools.js';

beforeEach(() => {
  vi.clearAllMocks();
  logAIAction.mockResolvedValue({});
  escalateToClinic.mockResolvedValue({
    delivered: true,
    recipients: 1,
    clinicName: 'Clinic',
    clinicPhone: null,
    conversationId: 'conversation-1',
  });
});

describe('askClinicStaff PHI audit minimization', () => {
  it('keeps raw clinical question and reason out of AIActionLog.request', async () => {
    const question = 'Болит зуб после операции и опухла щека';
    const reason = 'Нужна оценка врача по клиническим симптомам';
    await PATIENT_TOOLS.askClinicStaff.execute(
      { question, reason, urgency: 'urgent' },
      { userId: 'patient-user-1', patientId: 'patient-1', clinicId: 'clinic-1' },
    );

    expect(logAIAction).toHaveBeenCalledWith(
      'patient-user-1',
      'ai-patient.askClinicStaff',
      { handoffRequested: true, urgency: 'urgent' },
      undefined,
      'patient-1',
    );
    const auditPayload = JSON.stringify(logAIAction.mock.calls);
    expect(auditPayload).not.toContain(question);
    expect(auditPayload).not.toContain(reason);

    expect(escalateToClinic).toHaveBeenCalledWith({
      patientId: 'patient-1',
      patientUserId: 'patient-user-1',
      clinicId: 'clinic-1',
      question,
      reason,
      urgency: 'urgent',
    });
  });
});
