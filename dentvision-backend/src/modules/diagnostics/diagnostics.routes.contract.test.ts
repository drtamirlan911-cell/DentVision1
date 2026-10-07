import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'),
  'utf8',
);

describe('diagnostics route contract', () => {
  it('has no shadowed duplicate HTTP method + path handlers', () => {
    const routes = [...source.matchAll(/diagnosticsRouter\.(get|post|patch|delete)\('([^']+)'/g)]
      .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
    expect(new Set(routes).size).toBe(routes.length);
  });


  it('resolves referral Clinic.id through the canonical organization scope', () => {
    expect(source).toContain('export async function assertClinicOrgAccess');
    expect(source).toContain("assertClinicOrgAccess(req.user!, referral.clinicId)");
    expect(source).toContain("assertClinicOrgAccess(req.user!, clinicId)");
  });

  it('keeps payment transition separate from referral status', () => {
    expect((source.match(/diagnosticsRouter\.post\('\/referrals\/:id\/mark-paid'/g) || [])).toHaveLength(1);
    expect(source).toContain("diagnosticsRouter.post('/referrals/:id/status'");
    expect(source).toContain("'REVIEWED','DELIVERED','CLOSED'");
    expect(source).not.toContain("status === 'PAID'");
  });

  it('assigns diagnostic referrals only to clinical clinic roles', () => {
    expect(source).toContain("['DOCTOR', 'OWNER', 'DIRECTOR'].includes(doctorAccess.role)");
    expect(source).not.toContain("['DOCTOR', 'OWNER', 'DIRECTOR', 'ADMIN'].includes(doctorAccess.role)");
  });


  it('does not grant cashier roles partner pricing/catalog mutation access', () => {
    expect(source).toContain('function canManagePartnerCatalog');
    expect(source).not.toContain("if (!canManagePartnerCatalog(req.user)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для приёма оплаты' })");
    const pricingSection = source.slice(source.indexOf("diagnosticsRouter.patch('/centers/:id/pricing'"), source.indexOf("diagnosticsRouter.get('/referrals'")); 
    expect((pricingSection.match(/if \(!canManagePartnerCatalog\(req\.user\)\)/g) || [])).toHaveLength(4);
    const billingSection = source.slice(source.indexOf("diagnosticsRouter.post('/referrals/:id/mark-paid'"), source.indexOf("diagnosticsRouter.delete('/referrals/:id'")); 
    expect((billingSection.match(/if \(!canManagePartnerBilling\(req\.user\)\)/g) || [])).toHaveLength(3);
  });

  it('keeps partner pricing and cashier handlers unique', () => {
    expect((source.match(/diagnosticsRouter\.patch\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.patch\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
  });
});
