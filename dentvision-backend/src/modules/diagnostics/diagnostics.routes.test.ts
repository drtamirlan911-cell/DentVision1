import { describe, expect, it } from 'vitest';
import { authorizeReferralListScope, partnerReferralReadPermission, partnerRoleKeysHavePermission, redactPartnerReferralFinancials } from './diagnostics.routes.js';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  role: 'LAB',
  organizationId: 'org-1',
  organizationOriginalId: 'lab-1',
  organizationType: 'LABORATORY',
  ...overrides,
}) as any;

describe('diagnostic and laboratory referral read permissions', () => {
  it('uses diagnostics.read for centers and lab.read for laboratories', () => {
    expect(partnerReferralReadPermission({ centerId: 'center-1' })).toBe('diagnostics.read');
    expect(partnerReferralReadPermission({ labId: 'lab-1' })).toBe('lab.read');
    expect(partnerReferralReadPermission({})).toBeNull();
  });

  it('allows canonical laboratory owners and technicians to read their own order list without diagnostic-center rights', () => {
    for (const role of ['MEDICAL_LAB_OWNER', 'MEDICAL_LAB_TECHNICIAN', 'DENTAL_LAB_OWNER', 'DENTAL_TECHNICIAN']) {
      expect(partnerRoleKeysHavePermission([role], 'lab.read')).toBe(true);
      expect(partnerRoleKeysHavePermission([role], 'diagnostics.read')).toBe(false);
    }
  });

  it('keeps diagnostic-center operational roles on diagnostics.read', () => {
    for (const role of ['DIAGNOSTIC_OWNER', 'DIAGNOSTIC_ADMIN', 'DIAGNOSTIC_MANAGER', 'DIAGNOSTIC_OPERATOR']) {
      expect(partnerRoleKeysHavePermission([role], 'diagnostics.read')).toBe(true);
      expect(partnerRoleKeysHavePermission([role], 'lab.read')).toBe(false);
    }
  });
});

describe('diagnostics partner finance authorization', () => {
  it('grants billing visibility only to partner roles with an explicit finance permission', () => {
    for (const role of ['DIAGNOSTIC_OWNER', 'DIAGNOSTIC_ADMIN', 'DIAGNOSTIC_MANAGER', 'DIAGNOSTIC_RECEPTION', 'DIAGNOSTIC_FINANCE']) {
      expect(partnerRoleKeysHavePermission([role], 'billing.read')).toBe(true);
    }
    for (const role of ['DIAGNOSTIC_OPERATOR', 'RADIOLOGIST', 'RADIOLOGY_TECHNICIAN', 'DIAGNOSTIC_QUALITY']) {
      expect(partnerRoleKeysHavePermission([role], 'billing.read')).toBe(false);
    }
  });

  it('keeps billing management narrower than billing visibility', () => {
    expect(partnerRoleKeysHavePermission(['DIAGNOSTIC_OWNER'], 'billing.manage')).toBe(true);
    expect(partnerRoleKeysHavePermission(['DIAGNOSTIC_FINANCE'], 'billing.manage')).toBe(true);
    for (const role of ['DIAGNOSTIC_ADMIN', 'DIAGNOSTIC_MANAGER', 'DIAGNOSTIC_RECEPTION', 'DIAGNOSTIC_OPERATOR', 'RADIOLOGIST']) {
      expect(partnerRoleKeysHavePermission([role], 'billing.manage')).toBe(false);
    }
  });

  it('removes financial amounts but preserves the operational paid state for non-finance roles', () => {
    const visible = redactPartnerReferralFinancials({
      id: 'ref-1',
      patientName: 'Пациент',
      paid: true,
      cost: 125000,
      platformFee: 10000,
      paidAt: new Date('2026-11-20T10:00:00Z'),
      settlementId: 'settlement-1',
      commissionMinor: '1000000',
      partnerPayoutMinor: '11500000',
      status: 'DELIVERED',
    });
    expect(visible).toEqual({
      id: 'ref-1',
      patientName: 'Пациент',
      paid: true,
      status: 'DELIVERED',
    });
  });
});

describe('diagnostics referral scope authorization', () => {
  it('allows a laboratory user to read its own laboratory scope', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-1' })).resolves.toEqual({ ok: true });
  });

  it('denies a laboratory user from another laboratory', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('does not confuse Organization.id with the underlying laboratory id', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'org-1' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('allows a diagnostic-center user only for its original center id', async () => {
    const diagnosticUser = user({
      organizationId: 'org-center',
      organizationOriginalId: 'center-1',
      organizationType: 'DIAGNOSTIC_CENTER',
    });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-1' })).resolves.toEqual({ ok: true });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к центру',
    });
  });

  it('keeps superadmin platform access explicit', async () => {
    await expect(authorizeReferralListScope(user({ role: 'SUPERADMIN', organizationId: undefined, organizationOriginalId: undefined, organizationType: undefined }), { labId: 'any-lab' })).resolves.toEqual({ ok: true });
  });
});
