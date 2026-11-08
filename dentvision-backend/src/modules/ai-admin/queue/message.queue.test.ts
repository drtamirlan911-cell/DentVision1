import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { executeRaw, queryRaw, txExecuteRaw, transaction } = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const txExecuteRaw = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback({
    $queryRaw: queryRaw,
    $executeRaw: txExecuteRaw,
  }));
  return {
    executeRaw: vi.fn(),
    queryRaw,
    txExecuteRaw,
    transaction,
  };
});

vi.mock('../../../lib/prisma.js', () => ({
  default: { $executeRaw: executeRaw, $transaction: transaction },
}));

import {
  claimMessages,
  enqueueMessage,
  failMessage,
} from './message.queue.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-queue-test-key-at-least-32-characters';
  vi.clearAllMocks();
  executeRaw.mockResolvedValue(1);
  txExecuteRaw.mockResolvedValue(1);
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

const message = {
  channel: 'WHATSAPP' as const,
  channelAccountId: 'account-1',
  externalUserId: '77010000000',
  text: 'Patient Ivan Petrov reports private diagnosis alpha',
  externalMessageId: 'wamid.1',
  receivedAt: new Date('2026-11-08T08:00:00.000Z'),
};

function valuesOf(call: any): unknown[] {
  return call?.values ?? [];
}

describe('AI Admin durable webhook queue encryption', () => {
  it('persists a ciphertext JSONB scalar rather than the raw incoming message', async () => {
    await enqueueMessage(message);
    const values = valuesOf(executeRaw.mock.calls[0][0]);
    const stored = values.find((value) => typeof value === 'string' && value.startsWith('"ENC:'));

    expect(stored).toBeTruthy();
    expect(stored).not.toContain('Ivan Petrov');
    expect(stored).not.toContain('private diagnosis alpha');
  });

  it('decrypts new queue rows before the worker receives them', async () => {
    const { encryptAiAdminJson } = await import('../conversation/phi.js');
    queryRaw.mockResolvedValueOnce([{
      id: 'queue-1',
      payload: encryptAiAdminJson(message),
      attempts: 0,
    }]);

    const rows = await claimMessages();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual(message);
    expect(rows[0].payload.receivedAt).toBeInstanceOf(Date);
  });

  it('continues to read legacy object-shaped JSONB queue rows', async () => {
    queryRaw.mockResolvedValueOnce([{
      id: 'queue-legacy',
      payload: {
        ...message,
        receivedAt: message.receivedAt.toISOString(),
      },
      attempts: 1,
    }]);

    const rows = await claimMessages();
    expect(rows[0].payload).toEqual(message);
    expect(rows[0].payload.receivedAt).toBeInstanceOf(Date);
  });

  it('encrypts diagnostic errors before writing the queue error column', async () => {
    const error = 'Provider error for Ivan Petrov: private diagnosis alpha';
    await failMessage('queue-1', error);
    const values = valuesOf(executeRaw.mock.calls[0][0]);
    const stored = values.find((value) => typeof value === 'string' && value.startsWith('ENC:'));

    expect(stored).toBeTruthy();
    expect(stored).not.toContain('Ivan Petrov');
    expect(stored).not.toContain('private diagnosis alpha');
  });
});
