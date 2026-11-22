import { describe, expect, it } from 'vitest';
import { authorizeReferralListScope, diagnosticsRouter, partnerReferralReadPermission, partnerRoleKeysHavePermission, redactPartnerReferralFinancials, redactPartnerReferralForList, redactPartnerDashboardStats } from './diagnostics.routes.js';
import { canReadDiagnosticCenterCatalog } from './diagnostics.service.js';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  role: 'LAB',
  organizationId: 'org-1',
  organizationOriginalId: 'lab-1',
  organizationType: 'LABORATORY',
  ...overrides,
}) as any;

describe('diagnostic center route matching', () => {
  it('registers the exact staff endpoint before the dynamic referral detail endpoint', () => {
    const getRoutes = (diagnosticsRouter as any).stack
      .filter((layer: any) => layer.route?.methods?.get)
      .map((layer: any) => layer.route.path);
    const staffIndex = getRoutes.indexOf('/centers/:id/worklist/staff');
    const detailIndex = getRoutes.indexOf('/centers/:centerId/worklist/:referralId');

    expect(staffIndex).toBeGreaterThanOrEqual(0);
    expect(detailIndex).toBeGreaterThanOrEqual(0);
    expect(staffIndex).toBeLessThan(detailIndex);
  });
});

describe('diagnostic center catalog visibility', () => {
  it('allows an active member to open its own catalog when public discovery is disabled', () => {
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: false,
      subscriptionActive: true,
      isActiveOrganizationMember: true,
    })).toBe(true);
  });

  it('does not expose a private catalog to non-members', () => {
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: false,
      subscriptionActive: true,
      isActiveOrganizationMember: false,
    })).toBe(false);
  });

  it('does not expose a catalog when the center subscription is inactive', () => {
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: true,
      subscriptionActive: false,
      isActiveOrganizationMember: true,
    })).toBe(false);
  });
});

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

describe('partner referral list data minimization', () => {
  it('keeps operational identity and workflow while removing clinical, financial and file data without those capabilities', () => {
    const visible = redactPartnerReferralForList({
      id: 'ref-1',
      patientId: 'patient-1',
      patientName: 'Пациент',
      patientIin: '900101123456',
      patientBirth: new Date('1990-01-01T00:00:00Z'),
      patientAge: 36,
      patientGender: 'F',
      patientPhone: '+77000000000',
      patientEmail: 'patient@example.test',
      complaints: 'Сильная боль',
      preliminaryDx: 'Пульпит',
      commentForLab: 'Срочно',
      studyGoal: 'Проверка',
      result: { conclusion: 'Sensitive result' },
      comments: [{ text: 'Sensitive comment' }],
      files: [{ fileName: 'patient-scan.dcm' }],
      cost: 125000,
      platformFee: 10000,
      paid: true,
      paidAt: new Date('2026-11-20T10:00:00Z'),
      settlementId: 'settlement-1',
      status: 'IN_PROGRESS',
      studyType: 'CBCT',
    }, { canReadClinical: false, canReadFinance: false, canReadFiles: false });

    expect(visible).toEqual({
      id: 'ref-1',
      patientName: 'Пациент',
      paid: true,
      status: 'IN_PROGRESS',
      studyType: 'CBCT',
    });
  });

  it('preserves authorized clinical fields but still removes finance and attachments when their capabilities are absent', () => {
    const visible = redactPartnerReferralForList({
      id: 'ref-2',
      patientIin: '900101123456',
      complaints: 'Сильная боль',
      files: [{ fileName: 'patient-scan.dcm' }],
      cost: 5000,
      status: 'SENT',
    }, { canReadClinical: true, canReadFinance: false, canReadFiles: false });

    expect(visible).toEqual({
      id: 'ref-2',
      patientIin: '900101123456',
      complaints: 'Сильная боль',
      status: 'SENT',
    });
  });

  it('does not expose recent patient referrals in finance-only dashboard projections', () => {
    const visible = redactPartnerDashboardStats({
      total: 4,
      recent: [{ id: 'ref-3', patientName: 'Пациент', cost: 3000 }],
    }, { canReadClinical: false, canReadFinance: true, canReadFiles: false });
    expect(visible).toEqual({ total: 4, recent: [] });
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
