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
    expect(text).toContain("treatmentCaseRouter.post('/', loadClinicAccess, blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.patch('/:id', loadClinicAccess, blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.delete('/:id', loadClinicAccess, blockClinicWrites");
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


describe('trial backfill contract', () => {
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

});
