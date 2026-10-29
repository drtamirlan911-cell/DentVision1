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
  db.clinicFindUnique.mockResolvedValue({ id: 'c1', name: 'Clinic', plan: 'ENTERPRISE', active: false });
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
});
