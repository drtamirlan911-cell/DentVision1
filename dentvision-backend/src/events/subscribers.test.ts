import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditLogCreate } = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { auditLog: { create: auditLogCreate } },
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
