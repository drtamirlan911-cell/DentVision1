import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  clinicUpdate: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpdate: vi.fn(),
  patientCount: vi.fn(),
  clinicMemberCount: vi.fn(),
  aiSessionCount: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: db.clinicFindUnique, update: db.clinicUpdate },
    subscription: { findUnique: db.subscriptionFindUnique, update: db.subscriptionUpdate },
    patient: { count: db.patientCount },
    clinicMember: { count: db.clinicMemberCount },
    aISession: { count: db.aiSessionCount },
  },
}));

import { resolveClinicAccess } from './planEntitlements.js';

beforeEach(() => {
  Object.values(db).forEach((mock) => mock.mockReset());
  db.clinicFindUnique.mockResolvedValue({ id: 'c1', name: 'Clinic', plan: 'ENTERPRISE', active: false, createdAt: new Date('2026-01-01T00:00:00.000Z') });
  db.subscriptionFindUnique.mockResolvedValue({
    ownerType: 'CLINIC',
    ownerId: 'c1',
    plan: 'enterprise',
    status: 'expired',
    periodEnd: new Date('2026-10-01T00:00:00.000Z'),
  });
  db.clinicUpdate.mockResolvedValue({ id: 'c1', active: true });
  db.subscriptionUpdate.mockResolvedValue({});
  db.patientCount.mockResolvedValue(2);
  db.clinicMemberCount.mockResolvedValue(1);
  db.aiSessionCount.mockResolvedValue(0);
});

describe('expired clinic access', () => {
  it('restores read-only access for clinics that the legacy expiry cron disabled', async () => {
    const access = await resolveClinicAccess('c1');
    expect(access).toMatchObject({ active: true, expired: true, writeBlocked: true, status: 'expired' });
    expect(db.clinicUpdate).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { active: true } });
  });

  it('expires a legacy DEMO clinic from createdAt even when the backfill subscription row is missing', async () => {
    db.clinicFindUnique.mockResolvedValue({
      id: 'c1', name: 'Legacy demo', plan: 'DEMO', active: true,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    db.subscriptionFindUnique.mockResolvedValue(null);

    const access = await resolveClinicAccess('c1');

    expect(access).toMatchObject({
      active: true,
      expired: true,
      writeBlocked: true,
      status: 'expired',
      periodEnd: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(db.subscriptionUpdate).not.toHaveBeenCalled();
  });


  it('bounds a non-DEMO trialing subscription with no periodEnd from Subscription.createdAt', async () => {
    const createdAt = new Date('2020-01-01T00:00:00.000Z');
    const expectedEnd = new Date('2020-01-31T00:00:00.000Z');
    db.clinicFindUnique.mockResolvedValue({
      id: 'c1', name: 'Enterprise trial', plan: 'ENTERPRISE', active: true,
      createdAt: new Date('2019-01-01T00:00:00.000Z'),
    });
    db.subscriptionFindUnique.mockResolvedValue({
      ownerType: 'CLINIC',
      ownerId: 'c1',
      plan: 'enterprise',
      status: 'trialing',
      periodEnd: null,
      createdAt,
    });

    const access = await resolveClinicAccess('c1');

    expect(access).toMatchObject({
      active: true,
      expired: true,
      writeBlocked: true,
      status: 'expired',
      periodEnd: expectedEnd,
    });
    expect(db.subscriptionUpdate).toHaveBeenCalledWith({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: 'c1' } },
      data: { periodEnd: expectedEnd, status: 'expired' },
    });
  });

  it('keeps a recent non-DEMO trial writable only until 30 days after Subscription.createdAt', async () => {
    const createdAt = new Date('2099-01-01T00:00:00.000Z');
    const expectedEnd = new Date('2099-01-31T00:00:00.000Z');
    db.clinicFindUnique.mockResolvedValue({
      id: 'c1', name: 'Enterprise trial', plan: 'ENTERPRISE', active: true,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    db.subscriptionFindUnique.mockResolvedValue({
      ownerType: 'CLINIC',
      ownerId: 'c1',
      plan: 'enterprise',
      status: 'trialing',
      periodEnd: null,
      createdAt,
    });

    const access = await resolveClinicAccess('c1');

    expect(access).toMatchObject({
      active: true,
      expired: false,
      writeBlocked: false,
      status: 'trialing',
      periodEnd: expectedEnd,
    });
    expect(db.subscriptionUpdate).toHaveBeenCalledWith({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: 'c1' } },
      data: { periodEnd: expectedEnd },
    });
  });

  it('keeps a legacy DEMO clinic writable only until its 30-day createdAt deadline when no subscription exists', async () => {
    db.clinicFindUnique.mockResolvedValue({
      id: 'c1', name: 'Recent demo', plan: 'DEMO', active: true,
      createdAt: new Date('2026-10-15T00:00:00.000Z'),
    });
    db.subscriptionFindUnique.mockResolvedValue(null);

    const access = await resolveClinicAccess('c1');

    expect(access).toMatchObject({
      active: true,
      expired: false,
      writeBlocked: false,
      status: 'trialing',
      periodEnd: new Date('2026-11-14T00:00:00.000Z'),
    });
  });

});
