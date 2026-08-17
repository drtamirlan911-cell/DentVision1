import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * createReferral/createRegistrationRequest used to spread the caller's raw
 * input object straight into `prisma.*.create({ data: { ...input } })`. The
 * TS parameter type on each function only documents the intended shape — it
 * doesn't strip anything at runtime, since the caller (the route handler)
 * builds the object via `{ ...req.body, doctorId: userId }` and excess-
 * property checks don't apply to spread expressions. These tests assert that
 * fields outside the explicit whitelist never reach Prisma, even when present
 * on the input object — the property that actually matters, not just "the
 * documented fields still work".
 */

const {
  referralCreate,
  referralCount,
  registrationRequestCreate,
  writeAuditLog,
  publish,
} = vi.hoisted(() => ({
  referralCreate: vi.fn(),
  referralCount: vi.fn(),
  registrationRequestCreate: vi.fn(),
  writeAuditLog: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    referral: { create: referralCreate, count: referralCount },
    registrationRequest: { create: registrationRequestCreate },
  },
}));
vi.mock('../compliance/audit.service.js', () => ({ writeAuditLog }));
vi.mock('../../lib/events.js', () => ({ publish }));
vi.mock('../../services/notification.service.js', () => ({
  createNotification: vi.fn(),
  createNotificationForCenter: vi.fn(),
  NOTIFICATION_TYPES: {},
}));
vi.mock('../notifications/dispatch.service.js', () => ({ dispatchNotifications: vi.fn() }));

import { createReferral, createRegistrationRequest } from './diagnostics.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  referralCount.mockResolvedValue(0);
  referralCreate.mockImplementation(async (args: any) => ({ id: args.data.id, ...args.data }));
  registrationRequestCreate.mockImplementation(async (args: any) => ({ id: args.data.id, ...args.data }));
});

describe('createReferral — mass-assignment whitelist', () => {
  const baseInput = {
    patientName: 'Иван Иванов',
    clinicId: 'clinic-1',
    doctorId: 'doctor-1',
    category: 'RADIOLOGY' as any,
    studyType: 'CBCT',
  };

  it('never lets a caller set financial/audit fields it did not expose', async () => {
    const tampered = {
      ...baseInput,
      // None of these are in createReferral's parameter type, but nothing
      // stops a caller from attaching them to the object at runtime (this is
      // exactly what `{ ...req.body, doctorId: userId }` in the route does).
      id: 'attacker-chosen-id',
      cost: 999999,
      platformFee: 0,
      paid: true,
      paidAt: new Date().toISOString(),
      settlementId: 'someone-elses-settlement',
      reviewerId: 'forged-reviewer',
      reviewedAt: new Date().toISOString(),
      operatorId: 'forged-operator',
      radiologistId: 'forged-radiologist',
      status: 'COMPLETED',
    } as any;

    await createReferral(tampered, 'doctor-1');

    expect(referralCreate).toHaveBeenCalledTimes(1);
    const data = referralCreate.mock.calls[0][0].data;
    expect(data.id).not.toBe('attacker-chosen-id');
    expect(data).not.toHaveProperty('cost');
    expect(data).not.toHaveProperty('platformFee');
    expect(data).not.toHaveProperty('paid');
    expect(data).not.toHaveProperty('paidAt');
    expect(data).not.toHaveProperty('settlementId');
    expect(data).not.toHaveProperty('reviewerId');
    expect(data).not.toHaveProperty('reviewedAt');
    expect(data).not.toHaveProperty('operatorId');
    expect(data).not.toHaveProperty('radiologistId');
    // status is server-decided from centerId/labId presence, not the caller's value
    expect(data.status).toBe('DRAFT');
  });

  it('still passes through every field it legitimately documents', async () => {
    await createReferral(
      { ...baseInput, centerId: 'center-1', priority: 'URGENT' as any, complaints: 'боль' },
      'doctor-1',
    );
    const data = referralCreate.mock.calls[0][0].data;
    expect(data.patientName).toBe(baseInput.patientName);
    expect(data.clinicId).toBe(baseInput.clinicId);
    expect(data.centerId).toBe('center-1');
    expect(data.priority).toBe('URGENT');
    expect(data.complaints).toBe('боль');
    expect(data.status).toBe('SENT'); // has centerId
  });
});

describe('createRegistrationRequest — mass-assignment whitelist', () => {
  it('never lets a caller set id/status/reviewer fields directly', async () => {
    const tampered = {
      type: 'center' as const,
      name: 'Test Center',
      id: 'attacker-chosen-id',
      status: 'APPROVED',
      reviewerId: 'forged-reviewer',
      reviewNote: 'forged note',
    } as any;

    await createRegistrationRequest(tampered);

    const data = registrationRequestCreate.mock.calls[0][0].data;
    expect(data.id).not.toBe('attacker-chosen-id');
    expect(data.status).toBe('PENDING');
    expect(data).not.toHaveProperty('reviewerId');
    expect(data).not.toHaveProperty('reviewNote');
  });
});
