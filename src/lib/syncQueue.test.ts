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
  cacheDayAppointments,
  enqueueAppointmentDelete,
  enqueueAppointmentUpsert,
  flushSyncQueue,
  getSyncQueue,
  readCachedDayAppointments,
} from './syncQueue';

const QUEUE_KEY = 'dv_schedule_sync_queue_v1';

const workspaceContext = (
  clinicId: string,
  workspaceId = `workspace-${clinicId}`,
  workspaceBranchId: string | null = null,
  userId = `user-${clinicId}`,
  roleKey = 'owner',
  organizationId: string | null = `organization-${clinicId}`,
) => ({ clinicId, organizationId, workspaceId, workspaceBranchId, userId, roleKey });

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



describe('offline schedule cache IAM privacy', () => {
  it('purges clinic/date-only legacy caches that have no workspace or branch identity', () => {
    const legacyKey = 'dv_schedule_day_clinic-a_2026-11-08';
    localStorage.setItem(legacyKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      appointments: [{ id: 'legacy-appt', patientName: 'Legacy sensitive name' }],
    }));

    expect(readCachedDayAppointments(workspaceContext('clinic-a'), '2026-11-08')).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('keeps the offline day cache isolated by organization, workspace, branch, user and role', () => {
    const date = '2026-11-08';
    const doctorContext = workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'doctor-a', 'doctor');
    const ownerContext = workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'owner-a', 'owner');
    const appointment = {
      id: 'appointment-opaque-id',
      clinicId: 'clinic-a',
      patientId: 'patient-opaque-id',
      doctorId: 'doctor-a',
      date,
      time: '10:00',
      patientName: 'Sensitive patient name',
      notes: 'Sensitive clinical note',
      diagnosis: 'Sensitive diagnosis',
    } as any;

    cacheDayAppointments(doctorContext, date, [appointment]);

    expect(readCachedDayAppointments(doctorContext, date)).toHaveLength(1);
    expect(readCachedDayAppointments(ownerContext, date)).toBeNull();
    const stored = Object.keys(localStorage)
      .filter((key) => key.startsWith('dv_schedule_context_day_v2_'))
      .map((key) => localStorage.getItem(key) || '')
      .join('');
    expect(stored).not.toContain('Sensitive patient name');
    expect(stored).not.toContain('Sensitive clinical note');
    expect(stored).not.toContain('Sensitive diagnosis');
  });
});

describe('offline appointment queue replay', () => {
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


  it('surfaces localStorage persistence failures instead of claiming an edit was queued', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError with sensitive provider details');
    });

    expect(() => enqueueAppointmentUpsert({
      id: 'appointment-storage-failure',
      ...workspaceContext('clinic-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '10:00',
    })).toThrow('Не удалось сохранить офлайн-изменение на этом устройстве');
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    setItem.mockRestore();
  });

  it('keeps only the newest operation for an appointment ID', () => {
    enqueueAppointmentUpsert({
      id: 'appointment-1',
      ...workspaceContext('clinic-1'),
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '10:00',
    });
    enqueueAppointmentDelete('appointment-1', workspaceContext('clinic-1'));
    enqueueAppointmentUpsert({
      id: 'appointment-1',
      ...workspaceContext('clinic-1'),
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


  it('keeps a queued create before a delete for an appointment not yet on the server', () => {
    enqueueAppointmentUpsert({
      id: 'appointment-create-then-delete',
      ...workspaceContext('clinic-1'),
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '15:00',
    });
    enqueueAppointmentDelete('appointment-create-then-delete', workspaceContext('clinic-1'));

    const queue = getSyncQueue();
    expect(queue.map((item) => item.kind)).toEqual(['upsert', 'delete']);
    expect(queue[0].payload.id).toBe(queue[1].payload.id);
  });

  it('defers a delete until its preceding queued upsert succeeds', async () => {
    apiUpsertAppointment.mockRejectedValueOnce(new Error('temporary network failure'));
    enqueueAppointmentUpsert({
      id: 'appointment-create-then-delete',
      ...workspaceContext('clinic-1'),
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '15:30',
    });
    enqueueAppointmentDelete('appointment-create-then-delete', workspaceContext('clinic-1'));

    await expect(flushSyncQueue(workspaceContext('clinic-1'))).resolves.toEqual({ flushed: 0, remaining: 2 });
    expect(apiDeleteAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue().map((item) => item.kind)).toEqual(['upsert', 'delete']);

    await expect(flushSyncQueue(workspaceContext('clinic-1'))).resolves.toEqual({ flushed: 2, remaining: 0 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(2);
    expect(apiDeleteAppointment).toHaveBeenCalledWith('appointment-create-then-delete');
    expect(getSyncQueue()).toEqual([]);
  });

  it('does not send queue items while the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    enqueueAppointmentUpsert({
      id: 'appointment-offline',
      ...workspaceContext('clinic-opaque-id'),
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '12:00',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-opaque-id'))).resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(apiDeleteAppointment).not.toHaveBeenCalled();
  });

  it('replays appointment edits and deletes, then clears the queue', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-edit',
      ...workspaceContext('clinic-opaque-id'),
      patientId: 'patient-opaque-id',
      doctorId: 'doctor-opaque-id',
      patientName: 'Sensitive patient name',
      notes: 'Sensitive clinical note',
      date: '2026-11-08',
      time: '13:30',
    });
    enqueueAppointmentDelete('appointment-delete', workspaceContext('clinic-opaque-id'));

    await expect(flushSyncQueue(workspaceContext('clinic-opaque-id'))).resolves.toEqual({ flushed: 2, remaining: 0 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(1);
    expect(apiUpsertAppointment).toHaveBeenCalledWith(expect.objectContaining({
      id: 'appointment-edit',
      ...workspaceContext('clinic-opaque-id'),
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
      ...workspaceContext('clinic-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });
    enqueueAppointmentDelete('appointment-clinic-b', workspaceContext('clinic-b'));

    await expect(flushSyncQueue(workspaceContext('clinic-a'))).resolves.toEqual({ flushed: 1, remaining: 1 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(1);
    expect(apiDeleteAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue().map((item) => item.payload.clinicId)).toEqual(['clinic-b']);
  });


  it('does not replay when the active workspace differs even within the same clinic', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-workspace-a',
      ...workspaceContext('clinic-a', 'workspace-a', 'branch-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-b', 'branch-a')))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('does not replay when the active branch differs within the same workspace', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-branch-a',
      ...workspaceContext('clinic-a', 'workspace-a', 'branch-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:30',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', 'branch-b')))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('does not replay legacy queue rows without workspace context', async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{
      id: 'legacy-queue-item',
      kind: 'upsert',
      payload: {
        id: 'legacy-appointment',
        clinicId: 'clinic-a',
        patientId: 'patient-a',
        doctorId: 'doctor-a',
        date: '2026-11-08',
        time: '09:00',
      },
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    }]));

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', null)))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });


  it('does not replay legacy queue rows with workspace but no explicit branch context', async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([{
      id: 'legacy-branchless-queue-item',
      kind: 'upsert',
      payload: {
        id: 'legacy-branchless-appointment',
        clinicId: 'clinic-a',
        organizationId: 'organization-clinic-a',
        workspaceId: 'workspace-a',
        patientId: 'patient-a',
        doctorId: 'doctor-a',
        date: '2026-11-08',
        time: '09:00',
      },
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    }]));

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', null)))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });


  it('fails closed when identity or role is missing from active context', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-incomplete-context',
      ...workspaceContext('clinic-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });
    const incomplete = {
      clinicId: 'clinic-a',
      organizationId: 'organization-clinic-a',
      workspaceId: 'workspace-clinic-a',
      workspaceBranchId: null,
      roleKey: 'owner',
    } as any;

    await expect(flushSyncQueue(incomplete)).resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('fails closed and keeps the queue when no active clinic context is supplied', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-no-context',
      ...workspaceContext('clinic-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '09:00',
    });

    await expect(flushSyncQueue(null)).resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });



  it('refuses to queue changed clinical text that the local privacy sanitizer would remove', async () => {
    const existing = {
      id: 'appointment-clinical',
      notes: 'Existing notes',
      diagnosis: 'K04.7',
      toothNumber: '36',
      reason: 'Existing service',
      service: 'service-id-1',
      serviceName: 'Existing service',
    } as any;

    expect(() => assertQueueableAppointmentChange({
      id: existing.id,
      notes: 'New clinical note',
    }, existing)).toThrow(/можно сохранить только при подключении/);
    expect(() => assertQueueableAppointmentChange({
      id: existing.id,
      diagnosis: 'K04.8',
    }, existing)).toThrow(/можно сохранить только при подключении/);
    expect(() => assertQueueableAppointmentChange({
      id: existing.id,
      toothNumber: '37',
    }, existing)).toThrow(/можно сохранить только при подключении/);
    expect(() => assertQueueableAppointmentChange({
      id: existing.id,
      reason: 'New free-text clinical reason',
    }, existing)).toThrow(/можно сохранить только при подключении/);
  });

  it('allows ordinary schedule changes and catalog service IDs while preserving existing clinical text', () => {
    const existing = {
      id: 'appointment-operational',
      notes: 'Existing notes',
      diagnosis: 'K04.7',
      toothNumber: '36',
      reason: 'Existing service',
      service: 'service-id-1',
      serviceName: 'Existing service',
    } as any;

    expect(() => assertQueueableAppointmentChange({
      id: existing.id,
      date: '2026-11-09',
      time: '11:30',
      doctorId: 'doctor-2',
      serviceId: 'service-id-2',
      notes: 'Existing notes',
      diagnosis: 'K04.7',
      toothNumber: '36',
      reason: 'Existing service',
    }, existing)).not.toThrow();
  });

  it('preserves a newer offline edit enqueued while reconnect replay is in flight', async () => {
    let finishFirstRequest: (() => void) | undefined;
    apiUpsertAppointment.mockImplementationOnce(() => new Promise((resolve) => {
      finishFirstRequest = () => resolve({ ok: true });
    }));

    enqueueAppointmentUpsert({
      id: 'appointment-concurrent',
      ...workspaceContext('clinic-a', 'workspace-a', null),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '10:00',
    });

    const replay = flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', null));
    // flushSyncQueue reaches the first API request synchronously before awaiting it.
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(1);

    enqueueAppointmentUpsert({
      id: 'appointment-concurrent',
      ...workspaceContext('clinic-a', 'workspace-a', null),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '12:30',
    });
    finishFirstRequest?.();

    await expect(replay).resolves.toEqual({ flushed: 1, remaining: 1 });
    expect(getSyncQueue()).toHaveLength(1);
    expect(getSyncQueue()[0].payload.time).toBe('12:30');
  });


  it('does not replay when the active user changes in the same clinic/workspace/branch', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-user-a',
      ...workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'user-a'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '10:00',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'user-b')))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('does not replay when the active role changes for the same user/workspace', async () => {
    enqueueAppointmentUpsert({
      id: 'appointment-role-owner',
      ...workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'user-a', 'owner'),
      patientId: 'patient-a',
      doctorId: 'doctor-a',
      date: '2026-11-08',
      time: '10:30',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-a', 'workspace-a', 'branch-a', 'user-a', 'doctor')))
      .resolves.toEqual({ flushed: 0, remaining: 1 });
    expect(apiUpsertAppointment).not.toHaveBeenCalled();
    expect(getSyncQueue()).toHaveLength(1);
  });

  it('retains failed operations for the next reconnect without persisting raw errors', async () => {
    apiUpsertAppointment.mockRejectedValueOnce(new Error('Patient name and diagnosis echoed by API'));
    enqueueAppointmentUpsert({
      id: 'appointment-retry',
      ...workspaceContext('clinic-opaque-id'),
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      date: '2026-11-08',
      time: '14:00',
    });

    await expect(flushSyncQueue(workspaceContext('clinic-opaque-id'))).resolves.toEqual({ flushed: 0, remaining: 1 });
    const failed = getSyncQueue();
    expect(failed).toHaveLength(1);
    expect(failed[0].attempts).toBe(1);
    expect(failed[0]).not.toHaveProperty('lastError');
    expect(localStorage.getItem(QUEUE_KEY)).not.toContain('Patient name and diagnosis');

    await expect(flushSyncQueue(workspaceContext('clinic-opaque-id'))).resolves.toEqual({ flushed: 1, remaining: 0 });
    expect(apiUpsertAppointment).toHaveBeenCalledTimes(2);
    expect(getSyncQueue()).toEqual([]);
  });
});
