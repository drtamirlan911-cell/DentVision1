import { describe, expect, it } from 'vitest';
import { canAccessFinanceWallet } from './financeWalletBoundary.js';

const base = {
  role: 'MANAGER',
  clinicId: 'clinic-a',
  supplierId: null,
  organizationId: 'org-a',
};

describe('finance wallet ownership boundary', () => {
  it('allows a clinic wallet only for the same clinic', () => {
    expect(canAccessFinanceWallet(base, { ownerType: 'CLINIC', ownerId: 'clinic-a' })).toBe(true);
    expect(canAccessFinanceWallet(base, { ownerType: 'CLINIC', ownerId: 'clinic-b' })).toBe(false);
  });

  it('allows SUPERADMIN platform wallets', () => {
    expect(canAccessFinanceWallet({ ...base, role: 'SUPERADMIN' }, { ownerType: 'PLATFORM', ownerId: 'platform' })).toBe(true);
  });

  it('denies platform/gateway wallets to non-superadmin users', () => {
    expect(canAccessFinanceWallet(base, { ownerType: 'PLATFORM', ownerId: 'platform' })).toBe(false);
    expect(canAccessFinanceWallet(base, { ownerType: 'GATEWAY', ownerId: 'gateway' })).toBe(false);
  });

  it('denies unknown owner types and foreign organization wallets', () => {
    expect(canAccessFinanceWallet(base, { ownerType: 'UNKNOWN', ownerId: 'org-a' })).toBe(false);
    expect(canAccessFinanceWallet(base, { ownerType: 'PARTNER', ownerId: 'org-b' })).toBe(false);
  });
});
