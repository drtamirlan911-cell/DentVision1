import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiUpsertAppointment, apiDeleteAppointment } = vi.hoisted(() => ({
  apiUpsertAppointment: vi.fn(),
  apiDeleteAppointment: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  upsertAppointment: apiUpsertAppointment,
  deleteAppointment: apiDeleteAppointment,
}));

import {
  enqueueAppointmentDelete,
  enqueueAppointmentUpsert,
  flushSyncQueue,
  getSyncQueue,
} from './syncQueue';

const QUEUE_KEY = 'dv_schedule_sync_queue_v1';

describe('offline schedule queue privacy guard', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    apiUpsertAppointment.mockResolvedValue({ ok: true });
    apiDeleteAppointment.mockResolvedValue({ ok: true });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
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

  it('redacts procedure labels and tooth numbers but retains opaque service IDs for sync', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{
      id: 'queue-treatment',
      kind: 'upsert',
      payload: {
        id: 'appointment-opaque-id',
        clinicId: 'clinic-opaque-id',
        patientId: 'patient-opaque-id',
        doctorId: 'doctor-opaque-id',
        service: 'Имплантация зуба 11',
        serviceId: 'service-catalog-opaque-id',
        serviceName: 'Имплантация зуба 11',
        toothNumber: '11',
        date: '2026-10-20',
        time: '10:00',
        status: 'scheduled',
      },
      enqueuedAt: '2026-10-20T00:00:00.000Z',
      attempts: 0,
    }]));

    const queue = getSyncQueue();
    expect(queue).toHaveLength(1);
    const payload = queue[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty('serviceName');
    expect(payload).not.toHaveProperty('toothNumber');
    expect(payload).not.toHaveProperty('service');
    expect(payload.serviceId).toBe('service-catalog-opaque-id');

    const persisted = localStorage.getItem(QUEUE_KEY)!;
    expect(persisted).not.toContain('Имплантация зуба 11');
    expect(persisted).not.toContain('toothNumber');
    expect(persisted).not.toContain('"service":');
  });
});


describe('offline appointment queue replay', () => {
  it('keeps only the newest operation for an appointment ID', () => {
    enqueueAppointmentUpsert({
      id: 'appointment-1',
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '10:00',
    });
    enqueueAppointmentDelete('appointment-1', 'clinic-1');
    enqueueAppointmentUpsert({
      id: 'appointment-1',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '11:30',
    });

    const queue = getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe('upsert');
    expect(queue[0].payload.time).toBe('11:30');
  });

  it('does not send queue items while the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    enqueueAppointmentUpsert({
      id: 'appointment-offline',
      clinicId: 'clinic-opaque-id',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '12:00',
    });

    await expect(flushSyncQueue('clinic-opaque-id')).resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(apiDeleteAppointment).not.toHaveBeenCalled();
  });

  it('replays appointment edits and deletes, then clears the queue', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-edit',
      clinicId: 'clinic-opaque-id',
      patientId: 'patient-opaque-id',
      doctorId: 'doctor-opaque-id',
      patientName: 'Sensitive patient name',
      notes: 'Sensitive clinical note',
      date: '2026-11-08',
      time: '13:30',
    });
    enqueueAppointmentDelete('appointment-delete', 'clinic-opaque-id');

    await expect(flushSyncQueue('clinic-opaque-id')).resolves.toEqual({ flushed: 2, remaining: 0 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(1);
    expect(apiUpsertAppointment).toHaveBeenCalledWith(expect.objectContaining({
      id: 'appointment-edit',
      clinicId: 'clinic-opaque-id',
      patientId: 'patient-opaque-id',
      doctorId: 'doctor-opaque-id',
      date: '2026-11-08',
      time: '13:30',
    }));
    expect(apiUpsertAppointment.mock.calls[0][0]).not.toHaveProperty('patientName');
    expect(apiUpsertAppointment.mock.calls[0][0]).not.toHaveProperty('notes');
    expect(apiDeleteAppointment).toHaveBeenCalledWith('appointment-delete');
    expect(getSyncQueue()).toEqual([]);
  });


  it('never replays another clinic queue item in the current clinic context', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-clinic-a',
      clinicId: 'clinic-a',
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });
    enqueueAppointmentDelete('appointment-clinic-b', 'clinic-b');

    await expect(flushSyncQueue('clinic-a')).resolves.toEqual({ flushed: 1, remaining: 1 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(1);
    expect(apiDeleteAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue().map((item) => item.payload.clinicId)).toEqual(['clinic-b']);
  });

  it('fails closed and keeps the queue when no active clinic context is supplied', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-no-context',
      clinicId: 'clinic-a',
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });

    await expect(flushSyncQueue('')).resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('retains failed operations for the next reconnect without persisting raw errors', async () => {
    apiUpsertAppointment.mockRejectedValueOnce(new Error('Patient name and diagnosis echoed by API'));
    enqueueAppointmentUpsert({
      id: 'appointment-retry',
      clinicId: 'clinic-opaque-id',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '14:00',
    });

    await expect(flushSyncQueue('clinic-opaque-id')).resolves.toEqual({ flushed: 0, remaining: 1 });
    const failed = getSyncQueue();
    expect(failed).toHaveLength(1);
    expect(failed[0].attempts).toBe(1);
    expect(failed[0]).not.toHaveProperty('lastError');
    expect(localStorage.getItem(QUEUE_KEY)).not.toContain('Patient name and diagnosis');

    await expect(flushSyncQueue('clinic-opaque-id')).resolves.toEqual({ flushed: 1, remaining: 0 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(2);
    expect(getSyncQueue()).toEqual([]);
  });
});
