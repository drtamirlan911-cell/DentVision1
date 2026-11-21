import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'),
  'utf8',
);
const serviceSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.service.ts'),
  'utf8',
);
const roleMigration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261122010000_diagnostic_center_clinical_roles/migration.sql'),
  'utf8',
);
const iamContexts = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/iam/contexts.ts'),
  'utf8',
);
const workflowSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnosticCenterWorkflow.ts'),
  'utf8',
);
const schemaSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/schema.prisma'),
  'utf8',
);
const staffMigration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261121240000_diagnostic_center_staff_assignments/migration.sql'),
  'utf8',
);
const worklistUi = readFileSync(
  resolve(process.cwd(), 'src/pages/diagnostics/workspace/WorklistTab.tsx'),
  'utf8',
);
const teamUi = readFileSync(
  resolve(process.cwd(), 'src/pages/diagnostics/workspace/TeamTab.tsx'),
  'utf8',
);

describe('diagnostics route contract', () => {
  it('has no shadowed duplicate HTTP method + path handlers', () => {
    const routes = [...source.matchAll(/diagnosticsRouter\.(get|post|patch|delete)\('([^']+)'/g)]
      .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
    expect(new Set(routes).size).toBe(routes.length);
  });


  it('resolves referral Clinic.id through the canonical organization scope', () => {
    expect(source).toContain("import { assertClinicOrgAccess");
    expect(source).toContain("assertClinicOrgAccess(req.user!, referral.clinicId)");
    expect(source).toContain("assertClinicOrgAccess(req.user!, clinicId)");
  });

  it('does not calculate or publish commission before a paid settlement', () => {
    expect(serviceSource).not.toContain('diagnosticPlatformFee');
    expect(serviceSource).not.toContain('update.platformFee');
    expect(serviceSource).not.toContain('platformFee: updatedReferral.platformFee');
  });

  it('keeps payment transition separate from referral status', () => {
    expect((source.match(/diagnosticsRouter\.post\('\/referrals\/:id\/mark-paid'/g) || [])).toHaveLength(1);
    expect(source).toContain("diagnosticsRouter.post('/referrals/:id/status'");
    expect(source).toContain("'REVIEWED', 'DELIVERED', 'CLOSED'");
    expect(source).not.toContain("status === 'PAID'");
  });

  it('assigns diagnostic referrals only to clinical clinic roles', () => {
    expect(source).toContain("['DOCTOR', 'OWNER', 'DIRECTOR'].includes(doctorAccess.role)");
    expect(source).not.toContain("['DOCTOR', 'OWNER', 'DIRECTOR', 'ADMIN'].includes(doctorAccess.role)");
  });


  it('does not grant cashier roles partner pricing/catalog mutation access', () => {
    expect(source).toContain('function canManagePartnerCatalog');
    expect(source).not.toContain("if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' })");
    const pricingSection = source.slice(source.indexOf("diagnosticsRouter.patch('/centers/:id/pricing'"), source.indexOf("diagnosticsRouter.get('/centers/:id/modalities'")); 
    expect((pricingSection.match(/if \(!\(await canManagePartnerCatalog\(req\.user\)\)\)/g) || [])).toHaveLength(4);
    const billingSection = source.slice(source.indexOf("diagnosticsRouter.post('/referrals/:id/mark-paid'"), source.indexOf("diagnosticsRouter.delete('/referrals/:id'")); 
    expect((billingSection.match(/if \(!\(await canManagePartnerBilling\(req\.user\)\)\)/g) || [])).toHaveLength(3);
  });

  it('requires doctor-only clinical authorization on AI confirmation and clinic result signing', () => {
    expect(source).not.toContain("req.user!.role !== 'DOCTOR'");
    expect(source).toContain("await assertClinicDoctorSignoff({ userId: req.user!.id, clinicId: referral.clinicId, branchId: referral.branchId, assignedDoctorId: referral.doctorId })");
    expect(source).toContain("const signerScope = clinicAccess ? 'clinic' : diagnosticPartnerAccess ? 'diagnostic_center' : 'laboratory'");
    expect(source).toContain("const clinicAccess = req.user!.role !== 'SUPERADMIN' && await referralBranchAllowed(req.user!, referral)");
    expect(source).toContain("if (signerScope === 'clinic')");
  });

  it('keeps partner result signing distinct from clinic chart authorship', () => {
    expect(source).toContain("if (!clinicAccess && partnerAccess && !partnerCanSign)");
    expect(source).toContain("patientRecordUpdated: signerScope === 'clinic'");
    expect(source).toContain("hasScopedPartnerSignerRole(req.user!, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS)");
    expect(source).toContain("hasScopedPartnerSignerRole(req.user!, LAB_RESULT_SIGNER_ROLE_KEYS)");
  });


  it('exposes scoped modality management and a center-specific worklist', () => {
    const routes = source.slice(
      source.indexOf("diagnosticsRouter.get('/centers/:id/modalities'"),
      source.indexOf("diagnosticsRouter.get('/referrals'"),
    );
    expect(routes).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(routes).toContain('canManagePartnerCatalog(req.user)');
    expect(routes).toContain("diagnosticsRouter.get('/centers/:id/worklist'");
    expect(routes).toContain("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality'");
    expect(routes).toContain("status: 'active'");
    expect(routes).toContain('auditFromReq');
  });

  it('accepts only DICOM AE Title metadata, never PACS credentials or endpoints', () => {
    expect(source).toContain('DIAGNOSTIC_MODALITY_KINDS');
    expect(source).toContain('aeTitle.length > 16');
    expect(source).not.toContain('pacsPassword');
    expect(source).not.toContain('dicomPassword');
  });

  it('keeps partner pricing and cashier handlers unique', () => {
    expect((source.match(/diagnosticsRouter\.patch\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.patch\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
  });

  it('restricts diagnostic-center status updates to the canonical role-aware workflow', () => {
    expect(source).toContain('authorizeDiagnosticCenterStatusTransition');
    expect(source).toContain('activePartnerRoleKeys(req.user)');
    expect(source).toContain("sameOrgContext(req.user, 'DiagnosticCenter', String(referral.centerId))");
    expect(source).toContain("code: 'DIAGNOSTIC_SCHEDULE_REQUIRED'");
    expect(source).toContain('expectedStatus: referral.status');
    expect(serviceSource).toContain('REFERRAL_STATUS_CONFLICT');
    expect(serviceSource).toContain('where: { id, status: options?.expectedStatus ?? referral.status }');
    expect(workflowSource).toContain("SENT: ['ACCEPTED']");
    expect(workflowSource).toContain("ACCEPTED: ['SCHEDULED']");
    expect(workflowSource).toContain("PATIENT_ARRIVED: ['IN_PROGRESS']");
    expect(workflowSource).toContain('DIAGNOSTIC_RESULT_SIGN_REQUIRED');
    expect(workflowSource).toContain('DIAGNOSTIC_RESULT_UNSIGNED');
  });

  it('exposes center-only detail cards with audit history, not a broad clinic query', () => {
    const start = source.indexOf("diagnosticsRouter.get('/centers/:centerId/worklist/:referralId'");
    const end = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality'", start);
    const detailRoute = source.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(detailRoute).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(detailRoute).toContain('where: { id: referralId, centerId }');
    expect(detailRoute).toContain("where: { entity: 'referral', entityId: referralId }");
    expect(detailRoute).toContain('svc.getReferral(referralId)');
    expect(detailRoute).toContain('events');
  });

  it('minimizes patient names in the worklist for finance-only partner roles', () => {
    const start = source.indexOf("diagnosticsRouter.get('/centers/:id/worklist'");
    const end = source.indexOf("diagnosticsRouter.get('/centers/:centerId/worklist/:referralId'", start);
    const worklistRoute = source.slice(start, end);
    expect(worklistRoute).toContain('canReadDiagnosticCenterClinicalDetail(roleKeys)');
    expect(worklistRoute).toContain("patientName: 'Пациент'");
    expect(worklistRoute).toContain('activePartnerRoleKeys(req.user)');
  });

  it('checks the clinical-detail capability before fetching the full referral payload', () => {
    const start = source.indexOf("diagnosticsRouter.get('/centers/:centerId/worklist/:referralId'");
    const end = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality'", start);
    const detailRoute = source.slice(start, end);
    expect(detailRoute).toContain('canReadDiagnosticCenterClinicalDetail(roleKeys)');
    expect(detailRoute.indexOf('canReadDiagnosticCenterClinicalDetail')).toBeLessThan(detailRoute.indexOf('svc.getReferral(referralId)'));
  });


  it('lists center personnel only to managers in the active diagnostic-center context', () => {
    const start = source.indexOf("diagnosticsRouter.get('/centers/:id/worklist/staff'");
    const end = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/assignees'", start);
    const route = source.slice(start, end);
    expect(route).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(route).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(route).toContain("role: { in: ['operator', 'radiologist', 'manager', 'admin'] }");
    expect(route).toContain('firstName: member.user.firstName');
    expect(route).toContain('lastName: member.user.lastName');
  });

  it('assigns only center members with a matching organization-scoped IAM role', () => {
    const start = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/assignees'");
    const end = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality'", start);
    const route = source.slice(start, end);
    expect(route).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(route).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain('tx.diagnosticCenterMember.findFirst');
    expect(route).toContain('tx.personRole.findFirst');
    expect(route).toContain("role: { key: { in: ['operator', 'diagnostic_operator'] } }");
    expect(route).toContain("role: { key: { in: ['radiologist', 'diagnostic_radiologist'] } }");
    expect(route).toContain('centerId, userId: operatorUserId');
    expect(route).toContain('centerId, userId: radiologistUserId');
    expect(route).toContain('tx.operator.upsert');
    expect(route).toContain('tx.radiologist.upsert');
    expect(route).toContain("action: 'diagnostics.worklist.assignees.assign'");
    expect(route).toContain("if (!['SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS'].includes(String(referral.status)))");
  });

  it('keeps one operator and radiologist record per center and reflects assignments in the workflow UI', () => {
    expect(schemaSource).toContain('@@unique([centerId, userId])');
    expect(staffMigration).toContain('operators_centerId_userId_key');
    expect(staffMigration).toContain('radiologists_centerId_userId_key');
    expect(staffMigration).toContain('UPDATE "referrals" AS r');
    expect(worklistUi).toContain('getDiagnosticCenterWorklistStaff');
    expect(worklistUi).toContain('assignDiagnosticCenterWorklistStaff');
    expect(worklistUi).toContain('Оператор исследования');
    expect(worklistUi).toContain('Рентгенолог');
    expect(teamUi).toContain('Сотрудники центра');
  });

  it('keeps team listing and staff assignment manager-only and center/role scoped', () => {
    const listStart = source.indexOf("diagnosticsRouter.get('/centers/:id/worklist/staff'");
    const assignStart = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/assignees'");
    const modalityStart = source.indexOf("diagnosticsRouter.patch('/centers/:centerId/worklist/:referralId/modality'", assignStart);
    const listRoute = source.slice(listStart, assignStart);
    const assignRoute = source.slice(assignStart, modalityStart);
    expect(listRoute).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(listRoute).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(assignRoute).toContain("sameOrgContext(req.user, 'DiagnosticCenter', centerId)");
    expect(assignRoute).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(assignRoute).toContain("role: 'operator'");
    expect(assignRoute).toContain("role: 'radiologist'");
    expect(assignRoute).toContain('tx.personRole.findFirst');
    expect(assignRoute).toContain('auditFromReq(req,');
    expect(assignRoute).toContain("action: 'diagnostics.worklist.assignees.assign'");
    expect(assignRoute).toContain('FOR UPDATE');
  });


  it('maps invited diagnostic specialists to canonical scoped IAM roles and correct person types', () => {
    expect(serviceSource).toContain("operator: 'diagnostic_operator'");
    expect(serviceSource).toContain("radiologist: 'diagnostic_radiologist'");
    expect(serviceSource).toContain("normalizedRole === 'operator' ? 'OPERATOR'");
    expect(serviceSource).toContain("normalizedRole === 'radiologist' ? 'RADIOLOGIST'");
    expect(roleMigration).toContain("'diagnostic_operator'");
    expect(roleMigration).toContain("'diagnostic_radiologist'");
    expect(iamContexts).toContain("diagnostic_radiologist: 'DOCTOR'");
    expect(iamContexts).toContain("diagnostic_operator: 'ASSISTANT'");
  });

});
