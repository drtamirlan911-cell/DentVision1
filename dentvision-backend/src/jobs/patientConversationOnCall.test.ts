import { describe, expect, it, vi, beforeEach } from 'vitest';

const { conversationFindMany, conversationUpdate, clinicMemberFindMany, dispatchNotifications } = vi.hoisted(() => ({
  conversationFindMany: vi.fn(),
  conversationUpdate: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  dispatchNotifications: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    patientConversation: { findMany: conversationFindMany, update: conversationUpdate },
    clinicMember: { findMany: clinicMemberFindMany },
  },
}));

vi.mock('../modules/notifications/dispatch.service.js', () => ({ dispatchNotifications }));

import { runOnCallCheck } from './patientConversationOnCall.js';

/**
 * The whole point of this timer is that a thread nobody claimed gets a second
 * chance to be seen. The tests check the two ways that could quietly fail:
 * scanning the wrong set of threads, and re-notifying a clinic that has
 * nobody to notify (in which case `onCallNotifiedAt` must stay untouched, or
 * the thread would silently stop being checked).
 */

const CONVERSATION = {
  id: 'c1',
  clinicId: 'clinic-1',
  clinic: { id: 'clinic-1', name: 'DentVision' },
  patientUser: { firstName: 'Асель', lastName: 'Ким' },
};

beforeEach(() => {
  vi.clearAllMocks();
  dispatchNotifications.mockResolvedValue({});
});

describe('runOnCallCheck', () => {
  it('does nothing when nothing is stale', async () => {
    conversationFindMany.mockResolvedValueOnce([]);
    const result = await runOnCallCheck();
    expect(result).toEqual({ scanned: 0, renotified: 0 });
    expect(dispatchNotifications).not.toHaveBeenCalled();
  });

  it('only asks Prisma for WAITING threads past the cutoff, not claimed or resolved ones', async () => {
    conversationFindMany.mockResolvedValueOnce([]);
    await runOnCallCheck(15 * 60 * 1000);
    const where = conversationFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('WAITING');
    expect(where.lastPatientMessageAt).toEqual({ lte: expect.any(Date) });
  });

  it('re-notifies OWNER/ADMIN and stamps onCallNotifiedAt so the next pass does not re-fire immediately', async () => {
    conversationFindMany.mockResolvedValueOnce([CONVERSATION]);
    clinicMemberFindMany.mockResolvedValueOnce([{ userId: 'owner-1' }]);
    conversationUpdate.mockResolvedValueOnce({});

    const result = await runOnCallCheck();

    expect(result.renotified).toBe(1);
    expect(dispatchNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'owner-1', clinicId: 'clinic-1', type: 'patient_question' }),
    ]);
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { onCallNotifiedAt: expect.any(Date) },
    });
  });

  it('skips a clinic with no OWNER or ADMIN, and leaves onCallNotifiedAt untouched', async () => {
    conversationFindMany.mockResolvedValueOnce([CONVERSATION]);
    clinicMemberFindMany.mockResolvedValueOnce([]);

    const result = await runOnCallCheck();

    expect(result.renotified).toBe(0);
    expect(dispatchNotifications).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it('tolerates a table that does not exist yet (P2021) rather than crashing the interval', async () => {
    conversationFindMany.mockRejectedValueOnce({ code: 'P2021' });
    const result = await runOnCallCheck();
    expect(result).toEqual({ scanned: 0, renotified: 0 });
  });
});
