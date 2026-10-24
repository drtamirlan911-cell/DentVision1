import { describe, expect, it } from 'vitest';
import { canReadSupportTicket, isSupportStaffRole } from './supportPolicy.js';

describe('ecosystem support ticket visibility', () => {
  it('allows a requester to read only their own ticket', () => {
    expect(canReadSupportTicket({ id: 'user-a', role: 'DOCTOR' }, 'user-a')).toBe(true);
    expect(canReadSupportTicket({ id: 'user-a', role: 'DOCTOR' }, 'user-b')).toBe(false);
    expect(canReadSupportTicket({ id: 'user-a', role: 'DOCTOR' }, null)).toBe(false);
  });

  it('allows authenticated support staff and superadmin roles', () => {
    expect(isSupportStaffRole('SUPPORT')).toBe(true);
    expect(isSupportStaffRole('SUPERADMIN')).toBe(true);
    expect(canReadSupportTicket({ id: 'staff', role: 'SUPPORT' }, 'user-a')).toBe(true);
    expect(canReadSupportTicket({ id: 'root', role: 'SUPERADMIN' }, 'user-a')).toBe(true);
  });

  it('fails closed for missing identities and spoofed/unknown roles', () => {
    expect(canReadSupportTicket(null, 'user-a')).toBe(false);
    expect(canReadSupportTicket({ id: '', role: 'DOCTOR' }, '')).toBe(false);
    expect(canReadSupportTicket({ id: 'staff', role: 'support' }, 'user-a')).toBe(false);
    expect(canReadSupportTicket({ id: 'staff', role: 'ADMIN' }, 'user-a')).toBe(false);
    expect(isSupportStaffRole(undefined)).toBe(false);
  });
});
