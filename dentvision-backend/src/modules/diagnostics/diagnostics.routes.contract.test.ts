import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLINIC_ROLE_BY_KEY } from '../../lib/clinicRoleAccessRegistry.js';
import { PARTNER_ROLE_BY_KEY } from '../../lib/roleAccessRegistry.js';

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
const signedHistoryMigration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261122020000_diagnostic_signed_result_history/migration.sql'),
  'utf8',
);
const dicomParserSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/dicomMetadata.ts'),
  'utf8',
);
const dicomParserTests = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/dicomMetadata.test.ts'),
  'utf8',
);
const dicomMigration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261122030000_diagnostic_dicom_metadata_index/migration.sql'),
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


  it('requires the assigned radiologist for signing and result release', () => {
    const statusStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/status'");
    const signStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/results/sign'");
    const statusRoute = source.slice(statusStart, signStart);
    const signRoute = source.slice(signStart);
    expect(statusRoute).toContain('isAssignedRadiologist');
    expect(statusRoute).toContain('referral.radiologistId');
    expect(statusRoute).toContain('userId: req.user!.id, active: true');
    expect(signRoute).toContain('referral.radiologistId');
    expect(signRoute).toContain('hasScopedPartnerSignerRole(req.user!, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS)');
    expect(signRoute).toContain('userId: req.user!.id, active: true');
    expect(serviceSource).toContain("data.signerScope === 'diagnostic_center'");
    expect(serviceSource).toContain('assignedRadiologist');
    expect(serviceSource).toContain('hasSignerRole');
    expect(worklistUi).toContain('referral.radiologist.user.id === user?.id');
  });

  it('only allows a diagnostic-center radiologist to sign after acquisition and makes the first signature immutable', () => {
    expect(serviceSource).toContain('DIAGNOSTIC_RESULT_STAGE_INVALID');
    expect(serviceSource).toContain('DIAGNOSTIC_RESULT_ALREADY_SIGNED');
    expect(serviceSource).toContain("lockedReferral.status !== 'IN_PROGRESS'");
    expect(serviceSource).toContain('lockedReferral.result?.signedAt');
    expect(serviceSource).toContain('WHERE "id" = ${data.referralId} FOR UPDATE');
    expect(source).toContain('DIAGNOSTIC_RESULT_ALREADY_SIGNED');
    expect(source).toContain('DIAGNOSTIC_RESULT_STAGE_INVALID');
  });
  it('returns already-signed conflict before evaluating a completed referral stage', () => {
    const start = serviceSource.indexOf('export async function saveAndSignResult');
    const end = serviceSource.indexOf('export async function amendDiagnosticCenterResult', start);
    const signing = serviceSource.slice(start, end);
    const preflightSigned = signing.indexOf('if (referralSnapshot.result?.signedAt)');
    const preflightStage = signing.indexOf("if (referralSnapshot.status !== 'IN_PROGRESS')");
    const lockedSigned = signing.indexOf('if (lockedReferral.result?.signedAt)');
    const lockedStage = signing.indexOf("if (data.signerScope === 'diagnostic_center' && lockedReferral.status !== 'IN_PROGRESS')");
    expect(preflightSigned).toBeGreaterThanOrEqual(0);
    expect(preflightSigned).toBeLessThan(preflightStage);
    expect(lockedSigned).toBeGreaterThan(lockedStage === -1 ? 0 : -1);
    expect(lockedSigned).toBeLessThan(lockedStage);
  });


  it('derives clinic and partner medical/file access from canonical scoped role permissions', () => {
    for (const roleKey of ['DOCTOR', 'ASSISTANT', 'OWNER', 'ADMIN', 'MANAGER']) {
      expect(CLINIC_ROLE_BY_KEY[roleKey].permissions).toContain('medical.read');
    }
    for (const roleKey of ['CASHIER', 'ACCOUNTANT', 'RECEPTIONIST']) {
      expect(CLINIC_ROLE_BY_KEY[roleKey].permissions).not.toContain('medical.read');
    }

    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_OWNER.permissions).toContain('files.read');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_OWNER.permissions).toContain('medical.read');
    expect(PARTNER_ROLE_BY_KEY.RADIOLOGIST.permissions).toContain('medical.read');
    expect(source).toContain("DIAGNOSTIC_RADIOLOGIST: 'RADIOLOGIST'");
    expect(source).toContain('canonicalRoleAliases[roleKey] || roleKey');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_OPERATOR.permissions).toContain('files.read');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_OPERATOR.permissions).not.toContain('medical.read');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_RECEPTION.permissions).toContain('files.read');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_RECEPTION.permissions).not.toContain('medical.read');
    expect(PARTNER_ROLE_BY_KEY.DIAGNOSTIC_FINANCE.permissions).not.toContain('files.read');
    expect(PARTNER_ROLE_BY_KEY.MEDICAL_LAB_TECHNICIAN.permissions).toContain('files.read');
    expect(PARTNER_ROLE_BY_KEY.MEDICAL_LAB_TECHNICIAN.permissions).not.toContain('medical.read');
    expect(PARTNER_ROLE_BY_KEY.MEDICAL_LAB_DOCTOR.permissions).toContain('medical.read');

    expect(source).toContain('async function hasPartnerScopedPermission');
    expect(source).toContain("permissions.includes(permission)");
    expect(source).toContain('async function canReadClinicDiagnosticFiles');
    expect(source).toContain("role?.permissions.includes('medical.read')");
    expect(source).toContain('async function canReadReferralClinicalFiles');
    expect(source).toContain("hasPartnerScopedPermission(user, 'files.read')");
    expect(source).toContain("hasPartnerScopedPermission(user, 'medical.read')");
    expect(source).toContain('async function canWriteReferralClinicalFiles');
    expect(source).toContain("hasPartnerScopedPermission(user, 'files.write')");
    expect(source).toContain('async function canDeleteClinicDiagnosticFiles');
  });

  it('keeps operational diagnostic-center cards redacted unless the scoped role has medical.read', () => {
    expect(source).toContain('canReadDiagnosticCenterClinicalDetail(roleKeys)');
    expect(source).toContain("await hasPartnerScopedPermission(req.user, 'medical.read')");
    expect(source).toContain('redactDiagnosticCenterOperationalReferral(detail)');
    expect(source).toContain('for (const key of [');
    expect(source).toContain("'patientIin'");
    expect(source).toContain("'allergies'");
    expect(source).toContain("'result'");
    expect(source).toContain("Object.entries(event).filter(([key]) => key !== 'details')");
    expect(source).toContain('canReadReferralMedicalDetail(req.user, scope)');
  });

  it('separates operational detail, clinical detail and attachment permissions in the center worklist', () => {
    const start = source.indexOf("diagnosticsRouter.get('/centers/:centerId/worklist/:referralId'");
    const end = source.indexOf("diagnosticsRouter.get('/centers/:id/worklist/staff'", start);
    const route = source.slice(start, end);
    expect(route).toContain('canReadDiagnosticCenterClinicalDetail(roleKeys)');
    expect(route).toContain("await hasPartnerScopedPermission(req.user, 'medical.read')");
    expect(route).toContain('redactDiagnosticCenterOperationalReferral(detail)');
    expect(route).toContain("canReadFiles: await hasPartnerScopedPermission(req.user, 'files.read')");
    expect(source).toContain("'diagnostic_reception'");
    expect(source).toContain("DIAGNOSTIC_RADIOLOGIST: 'RADIOLOGIST'");
  });

  it('requires files.write for diagnostic attachment uploads and never returns internal S3 keys', () => {
    const uploadStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/files/upload'");
    const legacyStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/files'", uploadStart);
    const deleteStart = source.indexOf("diagnosticsRouter.delete('/referral-files/:id'", legacyStart);
    const multipartRoute = source.slice(uploadStart, legacyStart);
    const legacyRoute = source.slice(legacyStart, deleteStart);
    expect(multipartRoute).toContain('canWriteReferralClinicalFiles(req.user, referral)');
    expect(legacyRoute).toContain('canWriteReferralClinicalFiles(req.user, referral)');
    expect(multipartRoute).toContain('downloadAvailable: true');
    expect(legacyRoute).toContain('downloadAvailable: true');
    expect(multipartRoute).not.toContain('fileUrl: data.fileUrl');
    expect(legacyRoute).not.toContain('fileUrl: data.fileUrl');
  });

  it('issues fresh short-lived diagnostic attachment URLs only after scoped clinical access', () => {
    const start = source.indexOf("diagnosticsRouter.get('/referrals/:id/files/:fileId/download-url'");
    const end = source.indexOf("diagnosticsRouter.post('/referrals/:id/files/upload'", start);
    const route = source.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain('requireReferralAccess(true)');
    expect(route).toContain('canReadReferralClinicalFiles(req.user, referral)');
    expect(route).toContain('svc.getReferralFileDownloadUrl(referralId, fileId, req.user!.id)');
    expect(route).toContain("code === 'DIAGNOSTIC_STORAGE_UNAVAILABLE' ? 503");

    expect(serviceSource).toContain('export async function getReferralFileDownloadUrl');
    expect(serviceSource).toContain('where: { id: fileId, referralId }');
    expect(serviceSource).toContain('clinics/${referral.clinicId}/diagnostics/${referral.id}/');
    expect(serviceSource).toContain('const expiresInSeconds = 300');
    expect(serviceSource).toContain("action: 'DIAGNOSTIC_FILE_ACCESS_SIGNED'");
    expect(serviceSource).toContain('downloadAvailable: isStorageKey(file.fileUrl || \'\') && storageConfigured()');
    const detailStart = serviceSource.indexOf('export async function getReferral(id: string)');
    const detailEnd = serviceSource.indexOf('export async function createReferral', detailStart);
    expect(serviceSource.slice(detailStart, detailEnd)).not.toContain('signedDownloadUrl(');
    expect(worklistUi).toContain('getDiagnosticReferralFileDownloadUrl');
    expect(worklistUi).toContain('window.location.assign(target)');
  });

  it('parses DICOM Part 10 identifiers and indexes study, series and instances separately from stored pixel bytes', () => {
    expect(source).toContain("import { parseDicomPart10Metadata } from './dicomMetadata.js'");
    expect(source).toContain('const dicomMetadata = parseDicomPart10Metadata(file.buffer)');
    expect(source).toContain('dicomMetadata ? { dicomMetadata }');
    expect(source).toContain('data.dicomIndex');
    expect(dicomParserSource).toContain('DICOM Part 10 preamble is missing');
    expect(dicomParserSource).toContain('DICOM file meta SOP identifiers do not match the dataset');
    expect(dicomParserSource).toContain('DICOM_TRANSFER_SYNTAX_UNSUPPORTED');
    expect(dicomParserSource).toContain('TAG.pixelData');
    expect(dicomParserTests).toContain('skips undefined-length metadata sequences');
    expect(dicomParserTests).toContain('supports the standard implicit-VR little-endian');
    expect(dicomParserTests).toContain('rejects media-storage identifiers that disagree with the dataset');
  });

  it('stores PHI-minimized DICOM study/series/SOP metadata against the exact referral file and center', () => {
    expect(schemaSource).toContain('model DiagnosticDicomStudy');
    expect(schemaSource).toContain('model DiagnosticDicomSeries');
    expect(schemaSource).toContain('model DiagnosticDicomInstance');
    expect(schemaSource).toContain('@@unique([centerId, studyInstanceUid])');
    expect(schemaSource).toContain('@@unique([dicomStudyId, seriesInstanceUid])');
    expect(schemaSource).toContain('sopInstanceUid           String   @unique');
    expect(schemaSource).toContain('referralFileId           String   @unique');
    expect(dicomMigration).toContain('CREATE TABLE IF NOT EXISTS "diagnostic_dicom_studies"');
    expect(dicomMigration).toContain('CREATE TABLE IF NOT EXISTS "diagnostic_dicom_series"');
    expect(dicomMigration).toContain('CREATE TABLE IF NOT EXISTS "diagnostic_dicom_instances"');
    expect(serviceSource).toContain('DICOM_STUDY_LINK_CONFLICT');
    expect(serviceSource).toContain('tx.diagnosticDicomSeries.upsert');
    expect(serviceSource).toContain('tx.diagnosticDicomInstance.create');
    expect(serviceSource).toContain('file.dicomInstance ?');
    expect(serviceSource).not.toContain('patientName: metadata.patientName');
    expect(serviceSource).not.toContain('patientId: metadata.patientId');
  });

  it('fails closed for duplicate SOP objects, cross-referral Study UID and final-instance cleanup', () => {
    const uploadStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/files/upload'");
    const legacyStart = source.indexOf("diagnosticsRouter.post('/referrals/:id/files'", uploadStart);
    const uploadRoute = source.slice(uploadStart, legacyStart);
    expect(uploadRoute).toContain("DICOM_STUDY_LINK_CONFLICT");
    expect(uploadRoute).toContain("DICOM_INSTANCE_ALREADY_EXISTS");
    expect(uploadRoute).toContain("const conflict = ['DICOM_STUDY_LINK_CONFLICT'");
    expect(serviceSource).toContain("code: 'DICOM_INSTANCE_ALREADY_EXISTS'");
    expect(serviceSource).toContain('study.referralId !== referral.id');
    expect(serviceSource).toContain('series: { none: {} }');
    expect(serviceSource).toContain('instances: { none: {} }');
    expect(serviceSource).toContain("await deleteObject(storageKey).catch");
  });

  it('deletes referral-file metadata and audit before best-effort object cleanup', () => {
    const start = serviceSource.indexOf('export async function deleteReferralFile');
    const end = serviceSource.indexOf('// ─── Comments ───', start);
    const remove = serviceSource.slice(start, end);
    expect(remove.indexOf('await tx.referralFile.delete')).toBeGreaterThanOrEqual(0);
    expect(remove.indexOf('await tx.referralFile.delete')).toBeLessThan(remove.indexOf('await deleteObject(storageKey)'));
    expect(remove).toContain('objectCleanupScheduled: Boolean(storageKey)');
    expect(remove).toContain('private orphaned S3 object after metadata deletion');
    expect(source).toContain("diagnosticsRouter.delete('/referral-files/:id'");
    const deleteStart = source.indexOf("diagnosticsRouter.delete('/referral-files/:id'");
    const deleteEnd = source.indexOf("diagnosticsRouter.post('/referrals/:id/comments'", deleteStart);
    const deleteRoute = source.slice(deleteStart, deleteEnd);
    expect(deleteRoute).toContain('file.uploadedBy === req.user!.id');
    expect(deleteRoute).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(deleteRoute).toContain('canReadCenterClinicalFiles(req.user, referral.centerId)');
    expect(deleteRoute).toContain('canManageDiagnosticCenterTeam(req.user)');
    expect(deleteRoute).toContain('canManagePartnerDiagnosticFiles(req.user)');
  });

  it('stores signed report versions, backfills legacy signatures and exposes controlled amendments', () => {
    expect(schemaSource).toContain('model DiagnosticResultVersion');
    expect(schemaSource).toContain('versions DiagnosticResultVersion[]');
    expect(schemaSource).toContain('@@unique([diagnosticResultId, version])');
    expect(signedHistoryMigration).toContain('INSERT INTO "diagnostic_result_versions"');
    expect(signedHistoryMigration).toContain('WHERE result."signedAt" IS NOT NULL');
    expect(serviceSource).toContain('tx.diagnosticResultVersion.create');
    expect(serviceSource).toContain('export async function amendDiagnosticCenterResult');
    expect(serviceSource).toContain('changeReason: reason');
    expect(serviceSource).toContain("action: 'DIAGNOSTIC_RESULT_AMENDED'");
    expect(serviceSource).toContain("data: { status: 'COMPLETED', completedAt: now }");
    expect(serviceSource).toContain('versions: { orderBy: { version: \'asc\' } }');
    expect(source).toContain("diagnosticsRouter.post('/referrals/:id/results/amend'");
    expect(source).toContain("sameOrgContext(req.user, 'DiagnosticCenter', referral.centerId)");
    expect(worklistUi).toContain('История подписанных версий');
    expect(worklistUi).toContain('Подписать новую версию и вернуть на повторную передачу');
    expect(worklistUi).toContain('amendDiagnosticResult');
  });

});
