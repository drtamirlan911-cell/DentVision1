import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSyncQueue } from './syncQueue';

const QUEUE_KEY = 'dv_schedule_sync_queue_v1';

describe('offline schedule queue privacy guard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('scrubs legacy patient data and does not persist raw API error text', () => {
    const rawError = 'Could not save NAME_PLACEHOLDER; phone +7 777 123 45 67';
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{
      id: 'queue-row',
      kind: 'upsert',
      payload: {
        id: 'appointment-opaque-id',
        clinicId: 'clinic-opaque-id',
        patientId: 'patient-opaque-id',
        doctorId: 'doctor-opaque-id',
        patientName: 'NAME_PLACEHOLDER',
        patientPhone: '+7 777 123 45 67',
        reason: 'REASON_PLACEHOLDER',
        notes: 'CLINICAL_NOTES_PLACEHOLDER',
        diagnosis: 'DIAGNOSIS_PLACEHOLDER',
        date: '2026-10-20',
        time: '10:00',
        status: 'scheduled',
      },
      enqueuedAt: '2026-10-20T00:00:00.000Z',
      attempts: 1,
      lastError: rawError,
    }]));

    const queue = getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).not.toHaveProperty('lastError');

    const persisted = localStorage.getItem(QUEUE_KEY);
    expect(persisted).not.toBeNull();
    expect(persisted).not.toContain('NAME_PLACEHOLDER');
    expect(persisted).not.toContain('+7 777 123 45 67');
    expect(persisted).not.toContain('CLINICAL_NOTES_PLACEHOLDER');
    expect(persisted).not.toContain('Could not save');

    const parsed = JSON.parse(persisted!);
    expect(parsed[0]).not.toHaveProperty('lastError');
    expect(parsed[0].payload).toEqual({
      id: 'appointment-opaque-id',
      clinicId: 'clinic-opaque-id',
      patientId: 'patient-opaque-id',
      doctorId: 'doctor-opaque-id',
      date: '2026-10-20',
      time: '10:00',
      status: 'scheduled',
    });
  });
});
