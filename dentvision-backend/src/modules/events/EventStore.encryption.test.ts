import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  create,
  findMany,
  count,
  findUnique,
  queryRaw,
  txUpdateMany,
  transaction,
} = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const txUpdateMany = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
    $queryRaw: queryRaw,
    aIEvent: { updateMany: txUpdateMany },
  }));
  return {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    queryRaw,
    txUpdateMany,
    transaction,
  };
});

vi.mock('../../lib/prisma.js', () => ({
  default: {
    aIEvent: { create, findMany, count, findUnique },
    $transaction: transaction,
  },
}));

import { eventStore } from './EventStore.js';
import { encodeDurableEventPayload } from './eventPayloadEncryption.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;
const payload = { patientName: 'Иван Петров', diagnosis: 'private diagnosis alpha', patientId: 'patient-a' };

describe('EventStore encrypted payload persistence', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'event-store-test-key-that-is-long-enough-123456';
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it('writes ciphertext instead of a plaintext event payload', async () => {
    await eventStore.save({
      id: 'event-a',
      type: 'PatientCreated' as any,
      timestamp: new Date('2026-11-04T00:00:00.000Z'),
      source: 'test',
      clinicId: 'clinic-a',
      userId: 'user-a',
      payload,
    });
    const stored = create.mock.calls[0][0].data.payload as string;
    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain('Иван Петров');
    expect(stored).not.toContain('private diagnosis alpha');
  });

  it('decrypts a claimed event before subscribers receive it', async () => {
    queryRaw.mockResolvedValue([{
      id: 'event-a',
      type: 'PatientCreated',
      source: 'test',
      clinicId: 'clinic-a',
      userId: 'user-a',
      payload: encodeDurableEventPayload(payload),
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
    }]);
    txUpdateMany.mockResolvedValue({ count: 1 });
    const events = await eventStore.claimPending();
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual(payload);
  });

  it('decodes encrypted payloads returned by event list and detail readers', async () => {
    const stored = encodeDurableEventPayload(payload);
    findMany.mockResolvedValue([{ id: 'event-a', payload: stored }]);
    count.mockResolvedValue(1);
    findUnique.mockResolvedValue({ id: 'event-a', payload: stored });
    const listed = await eventStore.getEvents({ clinicId: 'clinic-a' });
    const detailed = await eventStore.getEventById('event-a');
    expect(listed.events[0].payload).toEqual(payload);
    expect(detailed?.payload).toEqual(payload);
  });

  it('keeps pre-encryption object rows readable', async () => {
    findMany.mockResolvedValue([{ id: 'legacy-event', payload }]);
    count.mockResolvedValue(1);
    const listed = await eventStore.getEvents({ clinicId: 'clinic-a' });
    expect(listed.events[0].payload).toEqual(payload);
  });
});
