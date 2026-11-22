import { describe, expect, it } from 'vitest';
import {
  resolveActivePartnerSettlementScope,
  settlementBelongsToActiveScope,
} from './settlementAccess.js';

describe('active partner settlement scope', () => {
  it('maps diagnostic-center context to its settlement owner', () => {
    expect(resolveActivePartnerSettlementScope({
      organizationType: 'DIAGNOSTIC_CENTER',
      organizationId: 'iam-org-1',
      organizationOriginalId: 'center-1',
    })).toEqual({ ownerType: 'CENTER', ownerId: 'center-1' });
  });

  it('maps laboratory context to its settlement owner', () => {
    expect(resolveActivePartnerSettlementScope({
      organizationType: 'LABORATORY',
      organizationId: 'lab-1',
    })).toEqual({ ownerType: 'LAB', ownerId: 'lab-1' });
  });

  it('rejects clinic, supplier, missing and unsupported contexts', () => {
    expect(resolveActivePartnerSettlementScope({ organizationType: 'CLINIC', organizationId: 'clinic-1' })).toBeNull();
    expect(resolveActivePartnerSettlementScope({ organizationType: 'SUPPLIER', organizationId: 'supplier-1' })).toBeNull();
    expect(resolveActivePartnerSettlementScope({ organizationType: 'LABORATORY' })).toBeNull();
    expect(resolveActivePartnerSettlementScope(null)).toBeNull();
  });

  it('matches only the exact active partner settlement owner', () => {
    const scope = { ownerType: 'CENTER' as const, ownerId: 'center-1' };
    expect(settlementBelongsToActiveScope(scope, { ownerType: 'CENTER', ownerId: 'center-1' })).toBe(true);
    expect(settlementBelongsToActiveScope(scope, { ownerType: 'CENTER', ownerId: 'center-2' })).toBe(false);
    expect(settlementBelongsToActiveScope(scope, { ownerType: 'LAB', ownerId: 'center-1' })).toBe(false);
    expect(settlementBelongsToActiveScope(null, { ownerType: 'CENTER', ownerId: 'center-1' })).toBe(false);
  });
});
