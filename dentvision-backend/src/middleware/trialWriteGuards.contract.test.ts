import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');

describe('trial read-only route coverage', () => {
  it('gates CRM operational mutations while leaving GETs readable', async () => {
    const text = await source('dentvision-backend/src/modules/crm/ops.routes.ts');
    expect(text).toContain('crmOpsRouter.use(loadClinicAccess)');
    expect(text).toContain('crmOpsRouter.use(blockClinicWrites)');
    expect(text).toContain("crmOpsRouter.post('/waiting-list'");
    expect(text).toContain("crmOpsRouter.delete('/expenses/:id'");
  });

  it('gates authenticated reminder mutations but preserves the secret-only cron endpoint', async () => {
    const text = await source('dentvision-backend/src/modules/crm/reminders.routes.ts');
    expect(text).toContain("remindersRouter.post('/waitlist', authenticate, loadClinicAccess, blockClinicWrites");
    expect(text).toContain("remindersRouter.post('/reminders/run', authenticate, loadClinicAccess, blockClinicWrites");
    const cronLine = text.split('\n').find(line => line.includes("remindersRouter.post('/reminders/cron'"));
    expect(cronLine).toBeTruthy();
    expect(cronLine).not.toContain('blockClinicWrites');
  });

  it('gates all treatment-case mutations as well as preserving read-only GETs', async () => {
    const text = await source('dentvision-backend/src/modules/crm/treatmentCase.routes.ts');
    expect(text).toContain("treatmentCaseRouter.post('/', loadClinicAccess, requirePermission('patient.write', 'medical.read', 'medical.write'), blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.patch('/:id', loadClinicAccess, requirePermission('patient.write', 'medical.read', 'medical.write'), blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.delete('/:id', loadClinicAccess, requirePermission('medical.manage'), blockClinicWrites");
  });

  it('does not lazily create clinic chairs on GET after the trial expires', async () => {
    const text = await source('dentvision-backend/src/modules/crm/chairs.routes.ts');
    expect(text).toContain('if (req.clinicAccess?.writeBlocked !== true) await ensureDefaultChairs(clinicId);');
  });

  it('checks clinic subscription before a patient can cancel an appointment', async () => {
    const text = await source('dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts');
    const start = text.indexOf("patientPortalRouter.post('/appointments/:id/cancel'");
    const route = text.slice(start, text.indexOf('\n', start));
    expect(route.indexOf('ensureClinicWritableForPatient')).toBeGreaterThan(-1);
    expect(route.indexOf('ensureClinicWritableForPatient')).toBeLessThan(route.indexOf('portalSvc.cancelAppointment'));
  });
});


describe('additional clinic-scoped mutation guards', () => {
  it('gates workflow create, update and run operations', async () => {
    const text = await source('dentvision-backend/src/modules/workflow/workflow.routes.ts');
    expect(text).toContain('workflowRouter.use(loadClinicAccess)');
    expect(text).toContain('workflowRouter.use(blockClinicWrites)');
  });

  it('gates cross-clinic access requests while preserving history reads', async () => {
    const text = await source('dentvision-backend/src/modules/cross-clinic/cross-clinic.routes.ts');
    expect(text).toContain('crossClinicRouter.use(loadClinicAccess)');
    expect(text).toContain('crossClinicRouter.use(blockClinicWrites)');
  });

  it('gates clinic BI write operations but keeps GET reports available', async () => {
    const text = await source('dentvision-backend/src/modules/bi/bi.routes.ts');
    expect(text).toContain('biRouter.use(loadClinicAccess)');
    expect(text).toContain('biRouter.use(blockClinicWrites)');
  });

  it('gates clinical inbox mutations after clinic subscription expiry', async () => {
    const text = await source('dentvision-backend/src/modules/patient-conversation/patientInbox.routes.ts');
    expect(text).toContain("patientInboxRouter.post('/conversations/:id/reply', authenticate, loadClinicAccess, blockClinicWrites");
    expect(text).toContain("patientInboxRouter.post('/conversations/:id/resolve', authenticate, loadClinicAccess, blockClinicWrites");
  });
});



  it('keeps clinic organization archive read-only after the 30-day trial expires without exposing another tenant trial state', async () => {
    const text = await source('dentvision-backend/src/modules/organizations/organizations.routes.ts');
    const routeStart = text.indexOf("organizationsRouter.delete('/:id'");
    const routeEnd = text.indexOf('\n});', routeStart);
    const route = text.slice(routeStart, routeEnd);
    const ownerCheck = route.indexOf("if (!org) return res.status(404)");
    const subscriptionCheck = route.indexOf('resolveClinicSubscriptionAccess(clinicId)');
    const archiveWrite = route.indexOf('prisma.organization.update');
    expect(ownerCheck).toBeGreaterThan(-1);
    expect(subscriptionCheck).toBeGreaterThan(ownerCheck);
    expect(archiveWrite).toBeGreaterThan(subscriptionCheck);
    expect(route).toContain("org.type === 'CLINIC'");
    expect(route).toContain("req.user?.role !== 'SUPERADMIN'");
    expect(route).toContain("code: 'SUBSCRIPTION_EXPIRED'");
  });

describe('trial backfill contract', () => {
  it('does not deactivate Clinic tenancy when an administrative subscription update marks it expired', async () => {
    const text = await source('dentvision-backend/src/modules/billing/subscriptions.routes.ts');
    expect(text).toContain('clinicTenancyUpdateForSubscription(clinicPlan as any, sub.status)');
    expect(text).not.toContain("active: status !== 'expired' && status !== 'suspended'");
  });

  it('keeps expired and explicitly suspended tenant lifecycle updates distinct', async () => {
    const text = await source('dentvision-backend/src/modules/billing/clinicSubscription.service.ts');
    expect(text).toContain("...(status === 'expired' ? {} : { active: status !== 'suspended' })");
    expect(text).toContain('data: clinicTenancyUpdateForSubscription(clinicPlan, status)');
  });

  it('upgrades only legacy 30-day DEMO trial rows to the same Enterprise capability set', async () => {
    const text = await source('dentvision-backend/prisma/migrations/20261029101000_backfill_legacy_clinic_trials/migration.sql');
    expect(text).toContain('SET "plan" = \'ENTERPRISE\'');
    expect(text).toContain('s."periodEnd" = c."createdAt" + INTERVAL \'30 days\'');
    expect(text).toContain('s."status" IN (\'trialing\', \'expired\')');
  });

  it('gates clinic-side diagnostics referral writes but permits partner completion workflows', async () => {
    const text = await source('dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts');
    expect(text).toContain('ensureClinicSubscriptionWritableIfClinicActor');
    expect(text).toContain('const isClinicActor = await assertClinicOrgAccess(req.user!, clinicId)');
    expect(text).toContain("code: 'SUBSCRIPTION_EXPIRED'");
  });

  it('preserves expired-clinic diagnostics referral reads while blocking referral mutations', async () => {
    const text = await source('dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts');
    expect(text).toContain("const isWriteRequest = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());");
    expect(text).toContain('if (isWriteRequest && !(await ensureClinicSubscriptionWritableIfClinicActor');
  });

  it('gates clinic IAM role assignment and removal after trial expiry', async () => {
    const text = await source('dentvision-backend/src/modules/iam/iam.routes.ts');
    expect(text).toContain('ensureClinicSubscriptionWritableForOrganization');
    expect(text).toContain("effectiveScopeType === 'platform' && !canAssignPlatformScope(req.user!.role)");
    const assignStart = text.indexOf("iamRouter.post('/persons/:personId/roles'");
    const assignEnd = text.indexOf("iamRouter.delete('/persons/:personId/roles/:roleId'", assignStart);
    const assignRoute = text.slice(assignStart, assignEnd);
    expect(assignRoute.indexOf('ensureClinicSubscriptionWritableForOrganization')).toBeGreaterThan(-1);
    expect(assignRoute.indexOf('ensureClinicSubscriptionWritableForOrganization')).toBeLessThan(assignRoute.indexOf('personRole.upsert'));
    const removeRoute = text.slice(assignEnd);
    expect(removeRoute.indexOf('ensureClinicSubscriptionWritableForOrganization')).toBeGreaterThan(-1);
    expect(removeRoute.indexOf('ensureClinicSubscriptionWritableForOrganization')).toBeLessThan(removeRoute.indexOf('personRole.deleteMany'));
  });


  it('does not reuse archived organization contexts during self-service onboarding retries', async () => {
    const text = await source('dentvision-backend/src/modules/organizations/organizations.routes.ts');
    expect(text).toContain('organization: { archivedAt: null }');
  });

  it('does not return an archived clinic from demo-clinic idempotency lookup', async () => {
    const text = await source('dentvision-backend/src/modules/auth/auth.routes.ts');
    expect(text).toContain("archivedAt: { not: null }");
    expect(text).toContain("if (!archivedOrganization) return { clinic: candidate.clinic, created: false };");
  });


  it('hides archived clinic memberships from legacy /me and /my-clinics discovery', async () => {
    const text = await source('dentvision-backend/src/modules/auth/me.routes.ts');
    expect(text).toContain('excludeArchivedClinicMemberships(allMemberships)');
    expect(text).toContain("originalType: 'Clinic', originalId: { in: clinicIds }, archivedAt: { not: null }");
    expect(text).toContain("where: { id: user.organizationId, archivedAt: null }");
  });

  it('reserves organization archive for owner-level roles, not generic administrators', async () => {
    const text = await source('dentvision-backend/src/modules/organizations/organizations.routes.ts');
    const match = text.match(/const archiveOwnerRoles = \[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const roles = [...(match?.[1] || '').matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
    expect(roles).toEqual([
      'owner', 'org_owner', 'seller', 'lecturer',
      'diagnostic_owner', 'medical_lab_owner', 'dental_lab_owner',
    ]);
    const archiveRoute = text.slice(text.indexOf("organizationsRouter.delete('/:id'"), text.indexOf('organizationsRouter.use(requireSuperadmin)'));
    expect(archiveRoute).toContain('role: { key: { in: archiveOwnerRoles } }');
  });

  it('blocks clinic invitation creation and new joins after archive or trial expiry', async () => {
    const text = await source('dentvision-backend/src/modules/auth/me.routes.ts');
    expect(text).toContain('ensureClinicContextWritableForInvitation(clinicId, res)');
    expect(text).toContain("where: { originalType: 'Clinic', originalId: invitation.clinicId, archivedAt: { not: null } }");
    expect(text).toContain('const subscription = await tx.subscription.findUnique');
    expect(text).toContain("subscription?.status === 'expired'");
    expect(text).toContain("subscription?.status === 'suspended'");
    expect(text).toContain("invitation.clinic.plan === 'DEMO'");
    expect(text).toContain('TRIAL_DAYS * 24 * 60 * 60 * 1000');
    expect(text).toContain("new ClinicInvitationError('Пробный период клиники завершён. Присоединение временно недоступно.', 402)");
  });


  it('rejects archived target clinics before clinic settings or staff mutations', async () => {
    const text = await source('dentvision-backend/src/modules/clinics/clinics.routes.ts');
    expect(text).toContain("where: { originalType: 'Clinic', originalId: clinicId, archivedAt: { not: null } }");
    expect(text).toContain("code: 'ORGANIZATION_ARCHIVED'");
    expect(text).toContain('resolveClinicSubscriptionAccess(clinicId)');
    const guardStart = text.indexOf('async function requireTargetClinicWritable');
    const guardEnd = text.indexOf('function normalizeStaffRole', guardStart);
    const guard = text.slice(guardStart, guardEnd);
    const archiveCheck = guard.indexOf('const archivedOrganization');
    const superadminBypass = guard.indexOf("if (req.user?.role === 'SUPERADMIN')");
    const membershipCheck = guard.indexOf('const membership = await resolveClinicAccess');
    const subscriptionCheck = guard.indexOf('resolveClinicSubscriptionAccess(clinicId)');
    expect(archiveCheck).toBeGreaterThanOrEqual(0);
    expect(superadminBypass).toBeGreaterThan(archiveCheck);
    expect(membershipCheck).toBeGreaterThanOrEqual(0);
    expect(membershipCheck).toBeLessThan(subscriptionCheck);
  });

  it('filters archived legacy clinics and enforces branch target tenant consistency', async () => {
    const clinics = await source('dentvision-backend/src/modules/clinics/clinics.routes.ts');
    expect(clinics).toContain("originalType: 'Clinic', originalId: { in: memberClinicIds }, archivedAt: { not: null }");
    const branches = await source('dentvision-backend/src/modules/branches/branches.routes.ts');
    expect(branches).toContain("if (!organizationClinicId || (clinicId && clinicId !== organizationClinicId))");
    expect(branches).toContain("organizationId = String(req.user?.organizationId || '').trim()");
    expect(branches).toContain("originalType: 'Clinic', originalId: clinicId, archivedAt: { not: null }");
    expect(branches).toContain("if (!activeOrganization) return null");
    const branchGuardStart = branches.indexOf('async function enforceTargetClinicTrial');
    const archivedIndex = branches.indexOf('if (archivedClinicOrganization)', branchGuardStart);
    const superadminIndex = branches.indexOf("if (req.user?.role === 'SUPERADMIN') return next();", branchGuardStart);
    expect(archivedIndex).toBeGreaterThan(branchGuardStart);
    expect(archivedIndex).toBeLessThan(superadminIndex);
    const membershipIndex = branches.indexOf('const member = await organizationMembership', branchGuardStart);
    const subscriptionIndex = branches.indexOf('resolveClinicSubscriptionAccess(clinicId)', branchGuardStart);
    expect(membershipIndex).toBeGreaterThan(branchGuardStart);
    expect(membershipIndex).toBeLessThan(subscriptionIndex);
  });


  it('blocks patient portal writes and booking lookup for archived clinics while preserving reads', async () => {
    const text = await source('dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts');
    expect(text).toContain('async function isClinicOrganizationArchived');
    expect(text).toContain("code: 'ORGANIZATION_ARCHIVED'");
    expect(text).toContain("if (await isClinicOrganizationArchived(clinicId)) return res.status(404)");
    expect(text).toContain("if (!clinicId || await isClinicOrganizationArchived(clinicId))");
  });

  it('blocks public document signing for archived clinic contexts', async () => {
    const text = await source('dentvision-backend/src/modules/public/public.routes.ts');
    expect(text).toContain("if (await isClinicOrganizationArchived(linkedDocument.clinicId)) return res.status(404)");
  });

});
