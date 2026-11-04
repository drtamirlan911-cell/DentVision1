import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirst, clinicMemberFindFirst } = vi.hoisted(() => ({ findFirst: vi.fn(), clinicMemberFindFirst: vi.fn() }));

vi.mock('../../../lib/prisma.js', () => ({
  default: { patient: { findFirst }, clinicMember: { findFirst: clinicMemberFindFirst } },
}));

import { encryptMedicalHistory } from '../../../lib/phi.js';
import { EventType, type CRMEvent } from '../../events/EventTypes.js';
import { getActionHandler } from './eventActions.js';
import { matchEventRules } from './eventRules.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;
const privateComplaint = 'private patient narrative alpha';

function patientCreatedEvent(): CRMEvent {
  return {
    id: 'event-1',
    type: EventType.PatientCreated,
    timestamp: new Date('2026-10-26T00:00:00.000Z'),
    source: 'crm.patient.created',
    clinicId: 'clinic-a',
    userId: 'user-a',
    payload: { patientId: 'patient-a', hasComplaints: true },
  };
}

describe('AI patient-created events keep clinical narrative out of durable payloads', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'phi-event-test-key-that-is-long-enough-123456';
    findFirst.mockReset();
    clinicMemberFindFirst.mockReset();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it('routes from a presence flag and ignores legacy complaint text in the durable payload', () => {
    expect(matchEventRules(EventType.PatientCreated, { patientId: 'patient-a', hasComplaints: true }).map((rule) => rule.id))
      .toContain('rule-patient-created');
    expect(matchEventRules(EventType.PatientCreated, { patientId: 'patient-a', hasComplaints: false }).map((rule) => rule.id))
      .not.toContain('rule-patient-created');
    expect(matchEventRules(EventType.PatientCreated, { patientId: 'patient-a', complaints: [privateComplaint] }).map((rule) => rule.id))
      .not.toContain('rule-patient-created');
  });

  it('reads encrypted history with clinic scope and does not persist complaint text in the action result', async () => {
    findFirst.mockResolvedValue({
      medicalHistory: encryptMedicalHistory({ complaints: [privateComplaint] }),
      notes: null,
    });
    const action = getActionHandler('analyzeComplaints');
    expect(action).toBeTypeOf('function');

    const result = await action!(patientCreatedEvent());

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-a', clinicId: 'clinic-a' },
      select: { medicalHistory: true, notes: true },
    });
    expect(JSON.stringify(result)).not.toContain(privateComplaint);
    expect(result.message).toContain('Откройте карточку пациента');
    expect(result.data).toHaveProperty('patientId', 'patient-a');
    expect(result.data).not.toHaveProperty('complaints');
  });

  it('scopes patient-arrived lookup and direct notification to the same clinic', async () => {
    findFirst.mockResolvedValue({ id: 'patient-a' });
    clinicMemberFindFirst.mockResolvedValue({ userId: 'doctor-a' });
    const action = getActionHandler('notifyDoctorPatientArrived');
    expect(action).toBeTypeOf('function');
    const event = {
      ...patientCreatedEvent(),
      type: EventType.PatientArrived,
      payload: { patientId: 'patient-a', doctorId: 'doctor-a' },
    };
    const result = await action!(event);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'patient-a', clinicId: 'clinic-a' }, select: { id: true } });
    expect(clinicMemberFindFirst).toHaveBeenCalledWith({ where: { clinicId: 'clinic-a', userId: 'doctor-a', role: 'DOCTOR' }, select: { userId: true } });
    expect(result.notifyUserIds).toEqual(['doctor-a']);
    expect(result.message).toBe('Пациент ожидает в приёмной. Откройте расписание для просмотра.');
    expect(JSON.stringify(result)).not.toContain('Иван Петров');
  });

  it('does not send a patient-arrived notification to a doctor outside the clinic', async () => {
    findFirst.mockResolvedValue({ id: 'patient-a' });
    clinicMemberFindFirst.mockResolvedValue(null);
    const action = getActionHandler('notifyDoctorPatientArrived');
    const event = { ...patientCreatedEvent(), type: EventType.PatientArrived, payload: { patientId: 'patient-a', doctorId: 'doctor-from-another-clinic' } };
    const result = await action!(event);
    expect(result.notifyUserIds).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('doctor-from-another-clinic');
  });

  it('keeps diagnosis and treatment narrative out of persisted notification messages', async () => {
    const diagnosis = 'private diagnosis narrative alpha';
    const recommendation = getActionHandler('generateTreatmentRecommendations');
    const documentation = getActionHandler('generateMedicalDocumentation');
    const recommendationResult = await recommendation!({ ...patientCreatedEvent(), type: EventType.DiagnosisSaved, payload: { patientId: 'patient-a', diagnosis, diagnosisCode: 'PRIVATE-1' } });
    const documentationResult = await documentation!({ ...patientCreatedEvent(), type: EventType.TreatmentCompleted, payload: { patientId: 'patient-a', appointmentId: 'appointment-a', diagnosis, treatments: ['private treatment'] } });
    expect(recommendationResult.message).not.toContain(diagnosis);
    expect(recommendationResult.message).not.toContain('PRIVATE-1');
    expect(documentationResult.message).not.toContain(diagnosis);
    expect(documentationResult.message).not.toContain('private treatment');
  });

  it('generates exam recommendations from the encrypted scoped history without copying the narrative', async () => {
    findFirst.mockResolvedValue({
      medicalHistory: encryptMedicalHistory({ complaints: ['сильная боль в зубе'] }),
      notes: null,
    });
    const action = getActionHandler('recommendExams');
    expect(action).toBeTypeOf('function');

    const result = await action!(patientCreatedEvent());

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-a', clinicId: 'clinic-a' },
      select: { medicalHistory: true, notes: true },
    });
    expect(result.data).toHaveProperty('exams');
    expect((result.data?.exams as string[])).toContain('КЛКТ');
    expect(JSON.stringify(result)).not.toContain('сильная боль в зубе');
  });
});
