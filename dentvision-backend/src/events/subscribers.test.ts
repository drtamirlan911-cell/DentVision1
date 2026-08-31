import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditLogCreate, assignmentUpsert } = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
  assignmentUpsert: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    auditLog: { create: auditLogCreate },
    patientAssignment: { upsert: assignmentUpsert },
  },
}));

import { publish } from '../lib/events.js';
import { registerSubscribers } from './subscribers.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSubscribers(); // idempotent — the module-level `registered` guard means later calls are no-ops
});

describe('subscribers: supplier.status_changed / lecturer.level_changed', () => {
  it('writes a platform-level (clinicId: null) audit row for a supplier status change', async () => {
    publish('supplier.status_changed', { supplierId: 'sup-1', status: 'active', from: 'pending', to: 'active', userId: 'u-1' });
    await flush();

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-1',
        clinicId: null,
        action: 'supplier.status_changed',
        entity: 'supplier',
        entityId: 'sup-1',
        details: { from: 'pending', to: 'active' },
      }),
    });
  });

  it('writes a platform-level audit row for a lecturer level change', async () => {
    publish('lecturer.level_changed', { lecturerId: 'lec-1', level: 'senior', from: 'junior', to: 'senior', userId: 'u-2' });
    await flush();

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u-2',
        clinicId: null,
        action: 'lecturer.level_changed',
        entity: 'lecturer',
        entityId: 'lec-1',
        details: { from: 'junior', to: 'senior' },
      }),
    });
  });

  it('defaults from/to to null and userId to null when the event omits them', async () => {
    publish('supplier.status_changed', { supplierId: 'sup-2', status: 'inactive' });
    await flush();

    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        entityId: 'sup-2',
        details: { from: null, to: null },
      }),
    });
  });
});

describe('subscribers: appointment.created → patient assignment', () => {
  it('makes the booked doctor responsible for the patient', async () => {
    publish('appointment.created', {
      clinicId: 'c-1',
      appointmentId: 'a-1',
      patientId: 'p-1',
      doctorId: 'd-1',
      userId: 'u-1',
    });
    await flush();

    expect(assignmentUpsert).toHaveBeenCalledTimes(1);
    expect(assignmentUpsert.mock.calls[0][0].create).toMatchObject({
      clinicId: 'c-1',
      patientId: 'p-1',
      userId: 'd-1',
      role: 'treating_doctor',
      active: true,
    });
  });

  it('still writes the audit row when there is no doctor to assign', async () => {
    publish('appointment.created', {
      clinicId: 'c-1',
      appointmentId: 'a-2',
      patientId: 'p-1',
      doctorId: null,
    });
    await flush();

    expect(assignmentUpsert).not.toHaveBeenCalled();
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'appointment.created', entityId: 'a-2' }),
    });
  });
});
