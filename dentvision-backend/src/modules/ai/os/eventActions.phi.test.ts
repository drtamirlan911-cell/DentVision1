import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('../../../lib/prisma.js', () => ({
  default: { patient: { findFirst } },
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
