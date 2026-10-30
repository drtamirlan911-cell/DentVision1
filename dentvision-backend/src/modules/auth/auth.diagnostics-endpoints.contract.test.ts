import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const auth = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/auth/auth.routes.ts'), 'utf8');
const authMe = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/auth/me.routes.ts'), 'utf8');
const compatibility = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/compat/compatRouter.ts'), 'utf8');
const diagnostics = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'), 'utf8');

describe('auth and diagnostics endpoint security contracts', () => {
  it('rotates only the current session on clinic switch and supports explicit context clearing', () => {
    expect((auth.match(/authRouter\.post\('\/switch-clinic'/g) || [])).toHaveLength(1);
    expect(auth).toContain("authRouter.post('/switch-clinic', authenticate");
    expect(auth).toContain('requestedClinicId === undefined ? user.memberships[0]?.clinicId : requestedClinicId');
    expect(auth).toContain('contextClinicId === undefined');
    expect(auth).toContain('await resolveAuthContext(user.id)');
    expect(auth).toContain('await resolveAuthContext(user.id, { clinicId: contextClinicId })');
    expect(auth).toContain('expireSession(rotateSessionId, user.id, tx)');
    expect(auth).toContain('await auditFromReq(req, {');
    expect(auth).toContain('previousClinicId: req.user?.clinicId ?? null');
    expect(auth).not.toContain('expireAllSessions(user.id)');
  });
  it('uses shared transactional clinic creation and keeps the 30-day Enterprise trial idempotent', () => {
    expect(auth).toContain("authRouter.post('/clinics', authenticate");
    expect(auth).toContain("authRouter.post('/demo-clinic', authenticate");
    expect(auth).toContain('createClinicForOwner(req.user!.id, input, {');
    expect(auth).toContain('createClinicForOwnerInTransaction(tx, req.user!.id, input, {');
    expect(auth).toContain("clinic: { plan: { in: ['DEMO', 'ENTERPRISE'] }, active: true }");
    const clinicCreation = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/clinics/clinicCreation.service.ts'), 'utf8');
    expect(clinicCreation).toContain("plan: 'ENTERPRISE'");
    expect(clinicCreation).toContain("plan: 'enterprise'");
    expect(clinicCreation).toContain("status: 'trialing'");
    expect(clinicCreation).toContain('TRIAL_DAYS');
  });
  it('claims invitations atomically, restricts invitation email and synchronizes canonical IAM', () => {
    expect((authMe.match(/authMeRouter\.post\('\/join-clinic'/g) || [])).toHaveLength(1);
    expect((authMe.match(/authMeRouter\.get\('\/invitations\/lookup'/g) || [])).toHaveLength(1);
    expect(authMe).toContain('usedAt: null');
    expect(authMe).toContain('data: { usedAt: now, usedBy: user.id }');
    expect(authMe).toContain('invitation.email.trim().toLowerCase() !== user.email.trim().toLowerCase()');
    expect(authMe).toContain('syncPersonFromClinicMember(joined.clinic.id, user.id, String(joined.membership.role))');
    expect(compatibility).not.toContain("compatRouter.post('/auth/invitations'");
  });
  it('protects global diagnostics data and rules with requireSuperadmin', () => {
    expect(diagnostics).toContain("diagnosticsRouter.get('/stats', requireSuperadmin");
    expect(diagnostics).toContain("diagnosticsRouter.get('/commission-rules', requireSuperadmin");
    expect(diagnostics).toContain("diagnosticsRouter.post('/commission-rules', requireSuperadmin");
    expect(diagnostics).toContain("where: { domain: 'diagnostics' }");
    expect(diagnostics).toContain('result[String(group.status).toUpperCase()] = group._count._all');
    expect(diagnostics).toContain('percentBps < 0 || percentBps > 10_000');
    expect(diagnostics).toContain("action: 'diagnostics.commission_rule.upsert'");
    expect(diagnostics).toContain("pg_advisory_xact_lock(hashtext('commission-rules:diagnostics:global'))");
  });
  it('keeps clinic bootstrap audit inside the clinic and IAM transaction', () => {
    const clinicCreation = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/clinics/clinicCreation.service.ts'), 'utf8');
    expect(clinicCreation).toContain('await writeAuditLog({ ...audit, entityId: clinic.id }, tx)');
    expect(clinicCreation).toContain('return prisma.$transaction((tx) => createClinicForOwnerInTransaction(tx, userId, input, audit))');
  });
  it('keeps the full canonical dashboard read model on platform diagnostics stats', () => {
    expect(diagnostics).toContain("diagnosticsRouter.get('/stats', requireSuperadmin");
    expect(diagnostics).toContain('svc.getDashboardStats({})');
    expect(diagnostics).toContain('data: { ...base, byStatus }');
  });
  it('writes commission-rule mutation and its audit event in one transaction', () => {
    expect(diagnostics).toContain('const rule = await prisma.$transaction(async (tx) => {');
    expect(diagnostics).toContain("await auditFromReq(req, { action: 'diagnostics.commission_rule.upsert', entity: 'commission_rule', entityId: savedRule.id }, tx)");
    expect(diagnostics).not.toContain("audit write failed");
  });

});
