import { describe, expect, it } from 'vitest';
import { resolveReferralListScope } from './referral-list-scope.js';

describe('resolveReferralListScope', () => {
  it('uses the verified diagnostic-center workspace when the query omits centerId', () => {
    expect(resolveReferralListScope({
      organizationType: 'DIAGNOSTIC_CENTER',
      organizationOriginalId: 'diagnostic-center-123',
      organizationId: 'canonical-org-456',
    } as any)).toEqual({ centerId: 'diagnostic-center-123' });
  });

  it('uses the verified medical-laboratory workspace when the query omits labId', () => {
    expect(resolveReferralListScope({
      organizationType: 'LABORATORY',
      organizationOriginalId: 'medical-lab-123',
    })).toEqual({ labId: 'medical-lab-123' });
  });

  it('defaults to the authenticated clinic for clinic-scoped list requests', () => {
    expect(resolveReferralListScope({ clinicId: 'clinic-123' })).toEqual({ clinicId: 'clinic-123' });
  });

  it('preserves explicit filters so the route authorization can reject cross-tenant requests', () => {
    expect(resolveReferralListScope({
      organizationType: 'DIAGNOSTIC_CENTER',
      organizationOriginalId: 'my-center',
    }, { centerId: 'other-center' })).toEqual({ centerId: 'other-center' });
  });

  it('does not invent a tenant scope for a platform user without an active workspace', () => {
    expect(resolveReferralListScope({ organizationType: null })).toEqual({});
  });
});
