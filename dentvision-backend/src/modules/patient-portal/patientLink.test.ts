import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirst, queryRaw, updateMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  queryRaw: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: { patient: { findFirst, updateMany }, $queryRaw: queryRaw },
}));

import { phoneNeedle, phonesMatch, resolvePatientForUser } from './patientLink.js';

const USER = { id: 'u1', email: 'patient@example.kz', phone: '+7 707 123 45 67' };

beforeEach(() => {
  findFirst.mockReset();
  queryRaw.mockReset();
  updateMany.mockReset();
  findFirst.mockResolvedValue(null);
  queryRaw.mockResolvedValue([]);
  updateMany.mockResolvedValue({ count: 1 });
});

describe('phone matching', () => {
  it('treats the formats Kazakh numbers are actually written in as one number', () => {
    // Reception types whichever it feels like; the patient types another.
    for (const written of ['+7 707 123 45 67', '87071234567', '7071234567', '+7(707)123-45-67']) {
      expect(phonesMatch(written, '+77071234567'), written).toBe(true);
    }
  });

  it('does not match two different numbers', () => {
    expect(phonesMatch('+77071234567', '+77071234568')).toBe(false);
  });

  it('refuses to match on nothing', () => {
    // An empty needle matching everything would hand out the first card found.
    expect(phoneNeedle('')).toBe('');
    expect(phoneNeedle('123')).toBe('');
    expect(phonesMatch('', '')).toBe(false);
    expect(phonesMatch(null, '+77071234567')).toBe(false);
  });
});

describe('resolvePatientForUser', () => {
  it('returns the already-linked card without touching anything', async () => {
    findFirst.mockResolvedValueOnce({ id: 'p1', clinicId: 'c1' });

    expect(await resolvePatientForUser(USER)).toEqual({ id: 'p1', clinicId: 'c1', via: 'userId' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('adopts a card that matches the email and writes the link once', async () => {
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'p2', clinicId: 'c1' });

    expect(await resolvePatientForUser(USER)).toMatchObject({ id: 'p2', via: 'email' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'p2', userId: null }, data: { userId: 'u1' } });
  });

  it('adopts a card that matches only the phone', async () => {
    queryRaw.mockResolvedValue([{ id: 'p3', clinicId: 'c1', phone: '8 707 123 45 67' }]);

    expect(await resolvePatientForUser(USER)).toMatchObject({ id: 'p3', via: 'phone' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'p3', userId: null }, data: { userId: 'u1' } });
  });

  it('rejects a candidate whose digits only partially overlap', async () => {
    queryRaw.mockResolvedValue([{ id: 'p4', clinicId: 'c1', phone: '+7 707 123 45 60' }]);

    expect(await resolvePatientForUser(USER)).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('never claims a card that already belongs to someone', async () => {
    await resolvePatientForUser(USER);

    const emailQuery = findFirst.mock.calls[1][0];
    expect(emailQuery.where).toMatchObject({ userId: null });
    expect(queryRaw).toHaveBeenCalled();
  });

  it('prefers the booking phone over the account phone', async () => {
    queryRaw.mockResolvedValue([{ id: 'p5', clinicId: 'c1', phone: '+7 701 000 11 22' }]);

    const match = await resolvePatientForUser(USER, { phoneHint: '8 701 000 11 22' });
    expect(match).toMatchObject({ id: 'p5', via: 'phone' });
  });

  it('scopes every lookup to the clinic when one is given', async () => {
    await resolvePatientForUser(USER, { clinicId: 'c9' });

    expect(findFirst.mock.calls[0][0].where).toMatchObject({ clinicId: 'c9' });
    expect(findFirst.mock.calls[1][0].where).toMatchObject({ clinicId: 'c9' });
    expect(queryRaw).toHaveBeenCalled();
  });

  it('returns null rather than inventing a match', async () => {
    expect(await resolvePatientForUser({ id: 'u2' })).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
