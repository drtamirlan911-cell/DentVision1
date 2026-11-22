import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatPartnerBranchMoney,
  formatPartnerBranchUnitPrice,
  isPartnerBranchInvoicePayable,
  partnerBranchInvoiceStatusLabel,
  partnerBranchInvoiceStatusTone,
  partnerBranchVerticalLabel,
} from './partnerBranchBilling';

describe('partner branch invoice presentation', () => {
  it('formats minor currency units without converting large ledger values to Number', () => {
    expect(formatPartnerBranchMoney('1990000').replace(/\s/g, '')).toBe('19900,00₸');
    expect(formatPartnerBranchMoney('9007199254740993').replace(/\s/g, '')).toBe('90071992547409,93₸');
    expect(formatPartnerBranchMoney('bad')).toBe('—');
  });

  it('formats tariff price and identifies the three approved partner verticals', () => {
    expect(formatPartnerBranchUnitPrice(49900).replace(/\s/g, '')).toBe('49900₸');
    expect(partnerBranchVerticalLabel('DIAGNOSTIC_3D')).toBe('Диагностический центр');
    expect(partnerBranchVerticalLabel('MEDICAL_ANALYSIS')).toBe('Медицинская лаборатория');
    expect(partnerBranchVerticalLabel('DENTAL_LAB')).toBe('Зуботехническая лаборатория');
  });

  it('only makes issued invoices payable and keeps payment states distinct', () => {
    expect(isPartnerBranchInvoicePayable('issued')).toBe(true);
    expect(isPartnerBranchInvoicePayable('payment_pending')).toBe(false);
    expect(isPartnerBranchInvoicePayable('paid')).toBe(false);
    expect(partnerBranchInvoiceStatusLabel('payment_pending')).toBe('Ожидает подтверждения');
    expect(partnerBranchInvoiceStatusTone('paid')).toBe('success');
    expect(partnerBranchInvoiceStatusTone('void')).toBe('error');
  });
  it('keeps partner payment creation bound to the immutable invoice and provider settlement', () => {
    const component = readFileSync(
      resolve(process.cwd(), 'src/components/billing/PartnerBranchSubscriptionBilling.tsx'),
      'utf8',
    );
    const api = readFileSync(resolve(process.cwd(), 'src/utils/api.ts'), 'utf8');
    const diagnosticWorkspace = readFileSync(
      resolve(process.cwd(), 'src/pages/diagnostics/workspace/DiagnosticWorkspace.tsx'),
      'utf8',
    );
    const dentalLabWorkspace = readFileSync(
      resolve(process.cwd(), 'src/pages/diagnostics/DentalLabPlatform.tsx'),
      'utf8',
    );

    expect(component).toContain('amountMinor: String(invoice.amountMinor)');
    expect(component).toContain("provider: 'kaspi_qr'");
    expect(component).toContain("refType: 'partner_branch_subscription_invoice'");
    expect(component).toContain('confirmPayment(selectedPaymentId)');
    expect(component).toContain('enabled: canManageBilling && Boolean(selectedPaymentId)');
    expect(component).toContain("invoice.status === 'issued' && canManageBilling");
    expect(api).toContain('/api/finance/partner-branch-billing/invoices?');
    expect(diagnosticWorkspace).toContain('activeWorkspace?.organizationId || user?.organizationId');
    expect(dentalLabWorkspace).toContain('activeWorkspace?.organizationId || user?.organizationId');
    expect(dentalLabWorkspace).toContain('canReadBilling={canManageFinance}');
    expect(component).not.toContain("status: 'paid'");
  });
  it('wires platform Finance Hub to the platform-only invoice issuance endpoint', () => {
    const adminPanel = readFileSync(
      resolve(process.cwd(), 'src/components/billing/PartnerBranchSubscriptionAdminPanel.tsx'),
      'utf8',
    );
    const financeTab = readFileSync(
      resolve(process.cwd(), 'src/pages/superadmin/FinanceTab.tsx'),
      'utf8',
    );
    const api = readFileSync(resolve(process.cwd(), 'src/utils/api.ts'), 'utf8');

    expect(financeTab).toContain("id: 'partner-billing'");
    expect(financeTab).toContain('<PartnerBranchSubscriptionAdminPanel />');
    expect(adminPanel).toContain("type: 'DIAGNOSTIC_CENTER'");
    expect(adminPanel).toContain("type: 'LABORATORY'");
    expect(adminPanel).toContain('issuePartnerBranchSubscriptionInvoice');
    expect(adminPanel).toContain('periodEnd: new Date(');
    expect(adminPanel).toContain('getPartnerBranchSubscriptionInvoices(organizationId || undefined, 100)');
    expect(api).toContain("apiRequest('/api/finance/partner-branch-billing/invoices',");
  });

  it('clears stale admin organization selection when the search changes', () => {
    const adminPanel = readFileSync(
      resolve(process.cwd(), 'src/components/billing/PartnerBranchSubscriptionAdminPanel.tsx'),
      'utf8',
    );
    expect(adminPanel).toContain("setSearch(event.target.value); setOrganizationId(''); setIssuedMessage('')");
    expect(adminPanel).toContain('disabled={!selectedOrganization || !validPeriod || issueMutation.isPending}');
    expect(adminPanel).toContain('const activeSelection = currentOrganizations.find((org) => org.id === organizationId)');
    expect(adminPanel).toContain('if (!activeSelection || !organizationId || !periodStart || !periodEnd');
  });

  it('does not release an old partner invoice hold until Kaspi confirms failed or expired', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    const start = routeSource.indexOf("paymentsRouter.get('/:id', authenticate");
    const end = routeSource.indexOf("paymentsRouter.post('/:id/confirm'", start);
    const paymentGet = routeSource.slice(start, end);

    const providerCheck = paymentGet.indexOf('providerStatus = await gateway.getPaymentStatus(payment.externalId)');
    const stalePaymentCheck = paymentGet.indexOf("payment.refType === 'partner_branch_subscription_invoice'");
    const terminalStatusGuard = paymentGet.indexOf("providerStatus === 'failed' || providerStatus === 'expired'");
    const invoiceRelease = paymentGet.indexOf('releasePartnerBranchSubscriptionInvoicePayment(');

    expect(providerCheck).toBeGreaterThanOrEqual(0);
    expect(stalePaymentCheck).toBeGreaterThan(providerCheck);
    expect(terminalStatusGuard).toBeGreaterThan(stalePaymentCheck);
    expect(invoiceRelease).toBeGreaterThan(terminalStatusGuard);
    expect(paymentGet).toContain('Provider-pending, provider-paid and unknown payments keep their hold');
  });

  it('releases a partner invoice immediately from confirm after provider-confirmed failed/expired', () => {
    const paymentRoutes = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/payments/payments.routes.ts'),
      'utf8',
    );
    const start = paymentRoutes.indexOf("paymentsRouter.post('/:id/confirm'");
    const end = paymentRoutes.indexOf('paymentsRouter.post(', start + 20);
    const confirm = paymentRoutes.slice(start, end);

    const terminalGuard = confirm.indexOf("providerStatus === 'failed' || providerStatus === 'expired'");
    const guardedPaymentUpdate = confirm.indexOf("where: { id: payment.id, status: 'pending' }");
    const invoiceRelease = confirm.indexOf('releasePartnerBranchSubscriptionInvoicePayment(');
    const latestRead = confirm.indexOf('tx.payment.findUniqueOrThrow({ where: { id: payment.id } })');

    expect(terminalGuard).toBeGreaterThanOrEqual(0);
    expect(guardedPaymentUpdate).toBeGreaterThan(terminalGuard);
    expect(invoiceRelease).toBeGreaterThan(guardedPaymentUpdate);
    expect(latestRead).toBeGreaterThan(invoiceRelease);
    expect(confirm).toContain("terminalPayment.status === 'paid'");
    expect(confirm).toContain("code: providerStatus === 'expired' ? 'PAYMENT_EXPIRED' : 'PAYMENT_FAILED'");
  });

  it('distinguishes provider terminal status from the locally released invoice state', () => {
    const component = readFileSync(
      resolve(process.cwd(), 'src/components/billing/PartnerBranchSubscriptionBilling.tsx'),
      'utf8',
    );
    expect(component).toContain("const providerFailed = ['failed', 'expired'].includes(providerStatus);");
    expect(component).toContain("const paymentFailed = ['failed', 'expired'].includes(paymentStatus);");
    expect(component).toContain("providerFailed ? 'Обновить статус счёта'");
    expect(component).toContain("if (paymentFailed) {");
    expect(component).toContain("!paymentFailed && invoice.status !== 'paid'");
  });


});
