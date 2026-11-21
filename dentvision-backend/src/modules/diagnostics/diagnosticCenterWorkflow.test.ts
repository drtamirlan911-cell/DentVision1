import { describe, expect, it } from 'vitest';
import { authorizeDiagnosticCenterStatusTransition, canReadDiagnosticCenterClinicalDetail } from './diagnosticCenterWorkflow.js';

describe('diagnostic center referral workflow authorization', () => {
  const owner = ['owner'];
  const operator = ['diagnostic_operator'];
  const radiologist = ['radiologist'];
  const canonicalRadiologist = ['diagnostic_radiologist'];

  it('requires a manager to accept a new referral', () => {
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'SENT', nextStatus: 'ACCEPTED', roleKeys: owner }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'SENT', nextStatus: 'ACCEPTED', roleKeys: operator })).toMatchObject({
      allowed: false, status: 403, code: 'DIAGNOSTIC_ACCEPT_FORBIDDEN',
    });
  });

  it('enforces the scheduling and acquisition sequence by role', () => {
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'ACCEPTED', nextStatus: 'SCHEDULED', roleKeys: operator }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'SCHEDULED', nextStatus: 'PATIENT_ARRIVED', roleKeys: operator }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'PATIENT_ARRIVED', nextStatus: 'IN_PROGRESS', roleKeys: radiologist }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'PATIENT_ARRIVED', nextStatus: 'IN_PROGRESS', roleKeys: canonicalRadiologist }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({ currentStatus: 'SENT', nextStatus: 'IN_PROGRESS', roleKeys: owner })).toMatchObject({
      allowed: false, status: 409, code: 'DIAGNOSTIC_STATUS_TRANSITION_INVALID',
    });
  });

  it('does not let the generic status route bypass radiologist result signing', () => {
    for (const roleKeys of [owner, operator, radiologist]) {
      expect(authorizeDiagnosticCenterStatusTransition({
        currentStatus: 'IN_PROGRESS', nextStatus: 'COMPLETED', roleKeys,
      })).toMatchObject({ allowed: false, status: 409, code: 'DIAGNOSTIC_RESULT_SIGN_REQUIRED' });
    }
  });

  it('requires a signed result before clinic delivery and keeps delivery role-scoped', () => {
    expect(authorizeDiagnosticCenterStatusTransition({
      currentStatus: 'COMPLETED', nextStatus: 'DELIVERED', roleKeys: owner,
    })).toMatchObject({ allowed: false, status: 409, code: 'DIAGNOSTIC_RESULT_UNSIGNED' });
    expect(authorizeDiagnosticCenterStatusTransition({
      currentStatus: 'COMPLETED', nextStatus: 'DELIVERED', roleKeys: canonicalRadiologist, resultSignedAt: new Date(), isAssignedRadiologist: false,
    })).toMatchObject({ allowed: false, status: 403, code: 'DIAGNOSTIC_RELEASE_FORBIDDEN' });
    expect(authorizeDiagnosticCenterStatusTransition({
      currentStatus: 'COMPLETED', nextStatus: 'DELIVERED', roleKeys: canonicalRadiologist, resultSignedAt: new Date(), isAssignedRadiologist: true,
    }).allowed).toBe(true);
    expect(authorizeDiagnosticCenterStatusTransition({
      currentStatus: 'COMPLETED', nextStatus: 'DELIVERED', roleKeys: operator, resultSignedAt: new Date(),
    })).toMatchObject({ allowed: false, status: 403, code: 'DIAGNOSTIC_RELEASE_FORBIDDEN' });
  });

  it('does not treat finance or unrelated roles as clinical operators', () => {
    expect(authorizeDiagnosticCenterStatusTransition({
      currentStatus: 'ACCEPTED', nextStatus: 'SCHEDULED', roleKeys: ['diagnostic_finance'],
    })).toMatchObject({ allowed: false, status: 403 });
  });

  it('keeps patient details away from finance-only memberships', () => {
    expect(canReadDiagnosticCenterClinicalDetail(['diagnostic_finance'])).toBe(false);
    expect(canReadDiagnosticCenterClinicalDetail(['radiologist'])).toBe(true);
    expect(canReadDiagnosticCenterClinicalDetail(['diagnostic_radiologist'])).toBe(true);
    expect(canReadDiagnosticCenterClinicalDetail(['diagnostic_operator'])).toBe(true);
    expect(canReadDiagnosticCenterClinicalDetail(['center_reception'])).toBe(true);
    expect(canReadDiagnosticCenterClinicalDetail(['diagnostic_manager'])).toBe(true);
  });
});
