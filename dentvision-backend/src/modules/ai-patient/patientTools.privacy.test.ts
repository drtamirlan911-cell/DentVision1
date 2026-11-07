import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { logAIAction, escalateToClinic, requestAppointment } = vi.hoisted(() => ({
  logAIAction: vi.fn(),
  escalateToClinic: vi.fn(),
  requestAppointment: vi.fn(),
}));

vi.mock('../compliance/compliance.service.js', () => ({ logAIAction }));
vi.mock('./escalation.service.js', () => ({ escalateToClinic }));
vi.mock('../patient-portal/patientPortal.service.js', () => ({ requestAppointment }));

import { PATIENT_TOOLS } from './patientTools.js';

beforeEach(() => {
  vi.clearAllMocks();
  logAIAction.mockResolvedValue({});
  requestAppointment.mockResolvedValue({ id: 'booking-1', status: 'pending' });
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
      { handoffRequested: true },
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
  it('keeps triage symptoms and clinical verdict out of AIActionLog.request', async () => {
    const answers = {
      painLevel: 9,
      swelling: 'spreading',
      breathingOrSwallowing: true,
      fever: true,
      durationDays: 3,
    };
    await PATIENT_TOOLS.assessUrgency.execute(
      answers,
      { userId: 'patient-user-1', patientId: 'patient-1', clinicId: 'clinic-1' },
    );
    expect(logAIAction).toHaveBeenCalledWith(
      'patient-user-1', 'ai-patient.assessUrgency', { assessmentCompleted: true }, undefined, 'patient-1',
    );
    const auditPayload = JSON.stringify(logAIAction.mock.calls);
    for (const value of ['painLevel', 'spreading', 'breathingOrSwallowing', 'patientMessage', 'reasonCode']) {
      expect(auditPayload).not.toContain(value);
    }
  });

  it('keeps appointment preferences and free-text service name out of AIActionLog.request', async () => {
    await PATIENT_TOOLS.requestAppointment.execute(
      {
        date: '2026-11-05',
        time: '14:30',
        doctorId: 'doctor-private-id',
        serviceName: 'сильная боль после имплантации',
      },
      { userId: 'patient-user-1', patientId: 'patient-1', clinicId: 'clinic-1' },
    );
    expect(logAIAction).toHaveBeenCalledWith(
      'patient-user-1', 'ai-patient.requestAppointment', { requestSubmitted: true }, undefined, 'patient-1',
    );
    const auditPayload = JSON.stringify(logAIAction.mock.calls);
    for (const value of ['2026-11-05', '14:30', 'doctor-private-id', 'сильная боль после имплантации']) {
      expect(auditPayload).not.toContain(value);
    }
    expect(requestAppointment).toHaveBeenCalledWith({
      patientId: 'patient-1',
      clinicId: 'clinic-1',
      date: '2026-11-05',
      time: '14:30',
      doctorId: 'doctor-private-id',
      serviceName: 'сильная боль после имплантации',
    });
  });

  it('encrypts patient AI history writes and decrypts history reads/replay', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/ai-patient/aiPatient.routes.ts'),
      'utf8',
    );
    expect(route).toContain('content: decryptAiTranscriptText(row.content)');
    expect(route).toContain('content: decryptAiTranscriptText(m.content)');
    expect(route).toContain('content: encryptAiTranscriptInput(text)');
    expect(route).toContain('content: encryptAiTranscriptInput(result.reply)');
    expect(route).toContain('prevUserText: encryptAiTranscriptInput(text)');
    expect(route).not.toContain('content: text, userId: req.user.id');
    expect(route).not.toContain('content: result.reply,');
    expect(route).not.toContain('prevUserText: text,');
  });

});
