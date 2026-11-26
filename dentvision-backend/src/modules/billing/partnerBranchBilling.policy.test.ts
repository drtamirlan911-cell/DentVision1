import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CRM-only SaaS partner monetization guard', () => {
  it('does not schedule partner branch subscription invoice issuance', () => {
    const bootstrap = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/index.ts'), 'utf8');
    expect(bootstrap).not.toContain('startPartnerBranchSubscriptionCronInterval');
  });

  it('rejects new partner branch subscription invoices while preserving legacy reads', () => {
    const routes = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/finance/finance.routes.ts'), 'utf8');
    const legacyReadStart = routes.indexOf("financeRouter.get('/partner-branch-billing/invoices'");
    const issueStart = routes.indexOf("financeRouter.post('/partner-branch-billing/invoices'");
    const commissionStart = routes.indexOf('// Commission rules (platform).');
    expect(legacyReadStart).toBeGreaterThanOrEqual(0);
    expect(issueStart).toBeGreaterThan(legacyReadStart);
    expect(commissionStart).toBeGreaterThan(issueStart);
    const issueRoute = routes.slice(issueStart, commissionStart);
    expect(issueRoute).toContain('status(410)');
    expect(issueRoute).toContain('PARTNER_SUBSCRIPTION_DISABLED');
    expect(issueRoute).not.toContain('issuePartnerBranchSubscriptionInvoice(');
  });

  it('does not expose branch-subscription payment UI in the diagnostic/laboratory workspace', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'src/pages/diagnostics/workspace/DiagnosticWorkspace.tsx'), 'utf8');
    expect(workspace).not.toContain('PartnerBranchSubscriptionBilling');
    expect(workspace).not.toContain('partnerBillingOrganizationId');
  });
});
