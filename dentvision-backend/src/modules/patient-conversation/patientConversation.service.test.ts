import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const {
  conversationFindFirst,
  conversationFindUnique,
  conversationFindMany,
  conversationCreate,
  conversationUpdate,
  messageFindMany,
  messageCreate,
  transaction,
} = vi.hoisted(() => ({
  conversationFindFirst: vi.fn(),
  conversationFindUnique: vi.fn(),
  conversationFindMany: vi.fn(),
  conversationCreate: vi.fn(),
  conversationUpdate: vi.fn(),
  messageFindMany: vi.fn(),
  messageCreate: vi.fn(),
  transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    patientConversation: {
      findFirst: conversationFindFirst,
      findUnique: conversationFindUnique,
      findMany: conversationFindMany,
      create: conversationCreate,
      update: conversationUpdate,
    },
    patientConversationMessage: {
      findMany: messageFindMany,
      create: messageCreate,
    },
    $transaction: transaction,
  },
}));

import { decryptField, encryptField } from '../../lib/phi.js';
import {
  getOrOpenConversation,
  getMessages,
  appendMessage,
  getThreadForClinic,
  replyAsStaff,
  ConversationError,
} from './patientConversation.service.js';

/**
 * The property that matters most here: a conversation belonging to one
 * clinic must be completely invisible to another, even by guessing its id.
 * Everything else — reuse-vs-create, who flips WAITING to LIVE — is ordinary
 * business logic, but the cross-clinic boundary is the one a bug here would
 * turn into a PHI leak.
 */

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'dentvision-patient-conversation-test-key-2026-11-04';
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

describe('getOrOpenConversation', () => {
  it('reuses an open thread instead of forking a second one', async () => {
    conversationFindFirst.mockResolvedValueOnce({ id: 'existing', status: 'WAITING' });
    const result = await getOrOpenConversation('user-1', 'clinic-1', 'не смог ответить');
    expect(result.id).toBe('existing');
    expect(conversationCreate).not.toHaveBeenCalled();
  });

  it('opens a new thread when none is open', async () => {
    conversationFindFirst.mockResolvedValueOnce(null);
    conversationCreate.mockImplementationOnce(async ({ data }) => ({ ...data, id: 'new' }));
    const result = await getOrOpenConversation('user-1', 'clinic-1', 'private escalation reason');
    expect(result.id).toBe('new');
    const storedReason = conversationCreate.mock.calls[0][0].data.escalationReason;
    expect(storedReason).toMatch(/^ENC:/);
    expect(storedReason).not.toContain('private escalation reason');
    expect(result.escalationReason).toBe('private escalation reason');
    expect(conversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING', escalationReason: storedReason }) }),
    );
  });

  it('only matches WAITING or LIVE — a RESOLVED thread does not silently reopen', async () => {
    // findFirst's own where clause is what the service asks Prisma to filter
    // by; this pins that the filter still asks for the open statuses.
    conversationFindFirst.mockResolvedValueOnce(null);
    conversationCreate.mockResolvedValueOnce({ id: 'new' });
    await getOrOpenConversation('user-1', 'clinic-1', 'reason');
    expect(conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['WAITING', 'LIVE'] } }) }),
    );
  });
});

describe('appendMessage', () => {
  it('rejects a message that is empty after trimming, without writing anything', async () => {
    await expect(appendMessage('c1', 'PATIENT', '   ')).rejects.toThrow('EMPTY_MESSAGE');
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('a patient message touches lastPatientMessageAt and nothing about status', async () => {
    messageCreate.mockImplementationOnce(async ({ data }) => ({ id: 'm1', ...data }));
    conversationUpdate.mockResolvedValueOnce({});
    const result = await appendMessage('c1', 'PATIENT', 'когда мой приём?');
    const storedBody = messageCreate.mock.calls[0][0].data.body;
    expect(storedBody).toMatch(/^ENC:/);
    expect(storedBody).not.toContain('когда мой приём?');
    expect(result.body).toBe('когда мой приём?');
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastPatientMessageAt: expect.any(Date) }),
      }),
    );
    const call = conversationUpdate.mock.calls[0][0];
    expect(call.data.status).toBeUndefined();
  });

  it('re-encrypts literal client text that begins with the storage marker', async () => {
    const literal = 'ENC:not-a-ciphertext-supplied-by-client';
    messageCreate.mockImplementationOnce(async ({ data }) => ({ id: 'm3', ...data }));
    conversationUpdate.mockResolvedValueOnce({});
    const result = await appendMessage('c1', 'PATIENT', literal);
    const storedBody = messageCreate.mock.calls[0][0].data.body;
    expect(storedBody).toMatch(/^ENC:/);
    expect(storedBody).not.toBe(literal);
    expect(decryptField(storedBody)).toBe(literal);
    expect(result.body).toBe(literal);
  });

  it('decrypts new encrypted messages and preserves legacy plaintext on reads', async () => {
    messageFindMany.mockResolvedValueOnce([
      { id: 'm-encrypted', body: encryptField('private clinical message')! },
      { id: 'm-legacy', body: 'legacy message' },
    ]);
    const messages = await getMessages('c1');
    expect(messages.map((message) => message.body)).toEqual([
      'private clinical message',
      'legacy message',
    ]);
  });

  it('a staff reply claims the thread into LIVE and assigns the replying staff member', async () => {
    messageCreate.mockImplementationOnce(async ({ data }) => ({ id: 'm2', ...data }));
    conversationUpdate.mockResolvedValueOnce({});
    const result = await appendMessage('c1', 'STAFF', 'сейчас перезвоним', 'staff-1');
    const storedBody = messageCreate.mock.calls[0][0].data.body;
    expect(storedBody).toMatch(/^ENC:/);
    expect(result.body).toBe('сейчас перезвоним');
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LIVE', assignedToUserId: 'staff-1', lastStaffMessageAt: expect.any(Date) }),
      }),
    );
  });
});

describe('cross-clinic isolation', () => {
  it('decodes the staff thread response while keeping persisted values encrypted', async () => {
    conversationFindUnique.mockResolvedValueOnce({
      id: 'c1',
      clinicId: 'clinic-A',
      escalationReason: encryptField('private handoff reason')!,
    });
    messageFindMany.mockResolvedValueOnce([
      { id: 'm1', body: encryptField('private patient question')! },
    ]);
    const result = await getThreadForClinic('clinic-A', 'c1');
    expect(result.conversation.escalationReason).toBe('private handoff reason');
    expect(result.messages[0].body).toBe('private patient question');
  });

  it('getThreadForClinic 404s on a conversation that exists but belongs to another clinic', async () => {
    conversationFindUnique.mockResolvedValueOnce({ id: 'c1', clinicId: 'clinic-B' });
    await expect(getThreadForClinic('clinic-A', 'c1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(messageFindMany).not.toHaveBeenCalled();
  });

  it('getThreadForClinic 404s identically on a conversation that does not exist at all', async () => {
    conversationFindUnique.mockResolvedValueOnce(null);
    const otherClinic = await getThreadForClinic('clinic-A', 'ghost').catch((e) => e);
    conversationFindUnique.mockResolvedValueOnce({ id: 'c1', clinicId: 'clinic-B' });
    const wrongClinic = await getThreadForClinic('clinic-A', 'c1').catch((e) => e);
    // Same shape either way — a caller cannot distinguish "doesn't exist" from
    // "exists, but not yours" by the error, which is what keeps an id guess
    // from becoming an existence oracle.
    expect(otherClinic).toBeInstanceOf(ConversationError);
    expect(wrongClinic).toBeInstanceOf(ConversationError);
    expect(otherClinic.code).toBe(wrongClinic.code);
    expect(otherClinic.message).toBe(wrongClinic.message);
  });

  it('replyAsStaff refuses a conversation from another clinic before ever writing a message', async () => {
    conversationFindUnique.mockResolvedValueOnce({ id: 'c1', clinicId: 'clinic-B', status: 'WAITING' });
    await expect(replyAsStaff('clinic-A', 'c1', 'staff-1', 'hi')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('replyAsStaff refuses a resolved thread', async () => {
    conversationFindUnique.mockResolvedValueOnce({ id: 'c1', clinicId: 'clinic-A', status: 'RESOLVED' });
    await expect(replyAsStaff('clinic-A', 'c1', 'staff-1', 'hi')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(messageCreate).not.toHaveBeenCalled();
  });
});
