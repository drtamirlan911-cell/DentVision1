import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * An escalation carries `lastUserMessage` — a patient's own words — so the
 * clinic boundary here is a PHI boundary, not a tidiness rule. Most of these
 * tests are about that, and about the end state the model always had columns
 * for and nothing ever wrote.
 */

const { prismaMock, notifyClinicOwners } = vi.hoisted(() => ({
  prismaMock: {
    aiAdminEscalation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
  notifyClinicOwners: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../../billing/clinicSubscription.service.js', () => ({ notifyClinicOwners }));

const {
  DEFAULT_ESCALATION_REMINDER_MS,
  EscalationError,
  countOpenEscalations,
  listEscalations,
  resolveEscalation,
  runEscalationReminders,
} = await import('./escalation.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.aiAdminEscalation.findMany.mockResolvedValue([]);
  prismaMock.aiAdminEscalation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.aiAdminEscalation.findUnique.mockResolvedValue({ id: 'e1' });
  notifyClinicOwners.mockResolvedValue(undefined);
});

describe('listing what is still open', () => {
  it('asks only for unresolved rows by default', async () => {
    await listEscalations('clinic-1');
    const where = prismaMock.aiAdminEscalation.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ clinicId: 'clinic-1', resolvedAt: null });
  });

  it('can include resolved ones when asked', async () => {
    await listEscalations('clinic-1', { includeResolved: true });
    const where = prismaMock.aiAdminEscalation.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ clinicId: 'clinic-1' });
  });

  it('scopes by clinic in the query, never after the fact', async () => {
    // Filtering in memory would mean another clinic's patient messages were
    // fetched at all, which is the part that matters.
    await listEscalations('clinic-1');
    expect(prismaMock.aiAdminEscalation.findMany.mock.calls[0][0].where.clinicId).toBe('clinic-1');
  });

  it('caps how much it will return', async () => {
    await listEscalations('clinic-1', { take: 10_000 });
    expect(prismaMock.aiAdminEscalation.findMany.mock.calls[0][0].take).toBe(200);
  });

  it('counts only what is open, for a badge', async () => {
    prismaMock.aiAdminEscalation.count.mockResolvedValue(3);
    expect(await countOpenEscalations('clinic-1')).toBe(3);
    expect(prismaMock.aiAdminEscalation.count.mock.calls[0][0].where).toEqual({
      clinicId: 'clinic-1',
      resolvedAt: null,
    });
  });
});

describe('resolving', () => {
  it('records who closed it and when', async () => {
    await resolveEscalation('clinic-1', 'e1', 'user-9');
    const call = prismaMock.aiAdminEscalation.updateMany.mock.calls[0][0];
    expect(call.data.resolvedBy).toBe('user-9');
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
  });

  it('matches on the clinic too, so a guessed id cannot reach another clinic', async () => {
    await resolveEscalation('clinic-1', 'e1', 'user-9');
    expect(prismaMock.aiAdminEscalation.updateMany.mock.calls[0][0].where).toMatchObject({
      id: 'e1',
      clinicId: 'clinic-1',
    });
  });

  it('refuses when nothing matched, rather than reporting success', async () => {
    prismaMock.aiAdminEscalation.updateMany.mockResolvedValue({ count: 0 });
    await expect(resolveEscalation('other-clinic', 'e1', 'user-9')).rejects.toBeInstanceOf(
      EscalationError,
    );
  });

  it('will not resolve the same escalation twice', async () => {
    // `resolvedAt: null` is in the match, so a second attempt finds nothing and
    // the original resolver and timestamp are not overwritten.
    await resolveEscalation('clinic-1', 'e1', 'user-9');
    expect(prismaMock.aiAdminEscalation.updateMany.mock.calls[0][0].where.resolvedAt).toBeNull();

    prismaMock.aiAdminEscalation.updateMany.mockResolvedValue({ count: 0 });
    await expect(resolveEscalation('clinic-1', 'e1', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('chasing escalations nobody picked up', () => {
  it('does nothing, and notifies nobody, when the queue is empty', async () => {
    const result = await runEscalationReminders();
    expect(result).toEqual({ checked: 0, renotified: 0 });
    expect(notifyClinicOwners).not.toHaveBeenCalled();
  });

  it('only looks at unresolved rows older than the threshold', async () => {
    await runEscalationReminders(15 * 60 * 1000);
    const where = prismaMock.aiAdminEscalation.findMany.mock.calls[0][0].where;
    expect(where.resolvedAt).toBeNull();
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    expect(Date.now() - where.createdAt.lte.getTime()).toBeGreaterThanOrEqual(15 * 60 * 1000 - 50);
  });

  it('re-notifies through the same channel the first notification used', async () => {
    prismaMock.aiAdminEscalation.findMany.mockResolvedValue([
      { id: 'e1', clinicId: 'clinic-1', reason: 'сложный вопрос' },
    ]);
    const result = await runEscalationReminders();
    expect(result).toEqual({ checked: 1, renotified: 1 });
    expect(notifyClinicOwners).toHaveBeenCalledWith(
      'clinic-1',
      expect.stringMatching(/без ответа/i),
      expect.stringContaining('сложный вопрос'),
    );
  });

  it('keeps going when one clinic’s notification fails', async () => {
    prismaMock.aiAdminEscalation.findMany.mockResolvedValue([
      { id: 'e1', clinicId: 'clinic-1', reason: 'a' },
      { id: 'e2', clinicId: 'clinic-2', reason: 'b' },
      { id: 'e3', clinicId: 'clinic-3', reason: 'c' },
    ]);
    notifyClinicOwners.mockRejectedValueOnce(new Error('smtp down'));

    const result = await runEscalationReminders();
    // One channel being down must not silence the other two clinics.
    expect(result).toEqual({ checked: 3, renotified: 2 });
  });

  it('uses the same threshold as the patient inbox on-call sweep', async () => {
    expect(DEFAULT_ESCALATION_REMINDER_MS).toBe(15 * 60 * 1000);
  });
});
