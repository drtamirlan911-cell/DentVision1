import { describe, expect, it, vi } from 'vitest';
import { normalizeClinicInput, createClinicForOwnerInTransaction } from './clinicCreation.service.js';
import { TRIAL_DAYS } from '../billing/clinicSubscription.service.js';

describe('clinic creation input contract', () => {
  it('keeps only supported profile fields and trims whitespace', () => {
    expect(normalizeClinicInput({ name: ' DentVision ', city: ' Taraz ', address: ' Main 1 ', phone: ' +7 777 ', plan: 'ENTERPRISE', role: 'SUPERADMIN', active: true }))
      .toEqual({ name: 'DentVision', city: 'Taraz', address: 'Main 1', phone: '+7 777' });
  });
  it('rejects a missing or oversized clinic name', () => {
    expect(normalizeClinicInput({ city: 'Taraz' })).toBeNull();
    expect(normalizeClinicInput({ name: 'x'.repeat(121) })).toBeNull();
  });
  it('rejects incorrectly typed or oversized optional fields', () => {
    expect(normalizeClinicInput({ name: 'Clinic', city: 123 })).toBeNull();
    expect(normalizeClinicInput({ name: 'Clinic', address: 'x'.repeat(301) })).toBeNull();
    expect(normalizeClinicInput({ name: 'Clinic', phone: 'x'.repeat(41) })).toBeNull();
  });
  it('uses a fixed demo name and does not accept a client subscription plan', () => {
    expect(normalizeClinicInput({ plan: 'ENTERPRISE' }, 'Моя демо-клиника')).toEqual({ name: 'Моя демо-клиника' });
    expect(normalizeClinicInput({ name: ' ', plan: 'PRO' }, 'Моя демо-клиника')?.name).toBe('Моя демо-клиника');
  });
});

describe('clinic creation trial bootstrap', () => {
  it('creates an Enterprise subscription ending exactly 30 days after creation', async () => {
    const now = new Date('2026-10-29T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const tx = {
        role: { findUnique: vi.fn().mockResolvedValue({ id: 'role-owner' }) },
        user: { findUnique: vi.fn().mockResolvedValue({ firstName: 'Owner', lastName: 'Test', phone: null, email: 'owner@example.test', spec: null }) },
        clinic: { create: vi.fn().mockResolvedValue({ id: 'clinic-1', plan: 'ENTERPRISE', active: true }) },
        subscription: { create: vi.fn().mockResolvedValue({ id: 'subscription-1' }) },
        clinicMember: { create: vi.fn().mockResolvedValue({}) },
        organization: { upsert: vi.fn().mockResolvedValue({ id: 'organization-1', name: 'Test clinic' }) },
        person: { upsert: vi.fn().mockResolvedValue({ id: 'person-1' }) },
        personRole: { upsert: vi.fn().mockResolvedValue({}) },
      };
      await createClinicForOwnerInTransaction(tx as any, 'user-1', { name: 'Test clinic' });
      const generatedClinicId = tx.clinic.create.mock.calls[0][0].data.id;
      const expectedPeriodEnd = new Date(now);
      expectedPeriodEnd.setDate(expectedPeriodEnd.getDate() + TRIAL_DAYS);
      expect(tx.clinic.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ plan: 'ENTERPRISE', active: true }),
      }));
      expect(tx.subscription.create).toHaveBeenCalledWith({
        data: {
          ownerType: 'CLINIC',
          ownerId: generatedClinicId,
          plan: 'enterprise',
          status: 'trialing',
          periodEnd: expectedPeriodEnd,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
