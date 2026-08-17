import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import {
  getOrOpenConversation,
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

beforeEach(() => {
  vi.clearAllMocks();
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
    conversationCreate.mockResolvedValueOnce({ id: 'new', status: 'WAITING' });
    const result = await getOrOpenConversation('user-1', 'clinic-1', 'reason');
    expect(result.id).toBe('new');
    expect(conversationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING', escalationReason: 'reason' }) }),
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
    messageCreate.mockResolvedValueOnce({ id: 'm1' });
    conversationUpdate.mockResolvedValueOnce({});
    await appendMessage('c1', 'PATIENT', 'когда мой приём?');
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastPatientMessageAt: expect.any(Date) }),
      }),
    );
    const call = conversationUpdate.mock.calls[0][0];
    expect(call.data.status).toBeUndefined();
  });

  it('a staff reply claims the thread into LIVE and assigns the replying staff member', async () => {
    messageCreate.mockResolvedValueOnce({ id: 'm2' });
    conversationUpdate.mockResolvedValueOnce({});
    await appendMessage('c1', 'STAFF', 'сейчас перезвоним', 'staff-1');
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'LIVE', assignedToUserId: 'staff-1', lastStaffMessageAt: expect.any(Date) }),
      }),
    );
  });
});

describe('cross-clinic isolation', () => {
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
