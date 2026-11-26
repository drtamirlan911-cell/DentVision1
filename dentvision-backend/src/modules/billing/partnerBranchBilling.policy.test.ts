import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('partner subscription plus transaction commission policy', () => {
  it('schedules monthly partner branch subscription invoices', () => {
    const bootstrap = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/index.ts'), 'utf8');
    expect(bootstrap).toContain("import { startPartnerBranchSubscriptionCronInterval } from './jobs/partnerBranchSubscriptionCron.js';");
    expect(bootstrap).toContain('startPartnerBranchSubscriptionCronInterval();');
  });

  it('allows platform finance to issue partner branch subscription invoices', () => {
    const routes = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/finance/finance.routes.ts'), 'utf8');
    const issueStart = routes.indexOf("financeRouter.post('/partner-branch-billing/invoices'");
    const commissionStart = routes.indexOf('// Commission rules (platform).');
    expect(issueStart).toBeGreaterThanOrEqual(0);
    expect(commissionStart).toBeGreaterThan(issueStart);
    const issueRoute = routes.slice(issueStart, commissionStart);
    expect(issueRoute).toContain('issuePartnerBranchSubscriptionInvoice(');
    expect(issueRoute).toContain('status(result.idempotent ? 200 : 201)');
    expect(issueRoute).not.toContain('PARTNER_SUBSCRIPTION_DISABLED');
  });

  it('exposes partner branch subscription billing in diagnostic and laboratory finance workspaces', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'src/pages/diagnostics/workspace/DiagnosticWorkspace.tsx'), 'utf8');
    expect(workspace).toContain("import { PartnerBranchSubscriptionBilling } from '@/components/billing/PartnerBranchSubscriptionBilling'");
    expect(workspace).toContain('partnerBillingOrganizationId');
    expect(workspace).toContain('<PartnerBranchSubscriptionBilling');
  });

  it('keeps transaction commissions as a separate monetization layer', () => {
    const economics = readFileSync(resolve(process.cwd(), 'docs/business/DENTVISION_PARTNER_ECONOMICS.md'), 'utf8');
    expect(economics).toContain('branch subscriptions and/or commissions');
    expect(economics).toContain('Branch subscription and transaction commission are separate economic layers');
    expect(economics).toContain('7% transaction commission');
    expect(economics).toContain('6% transaction commission');
  });
});
