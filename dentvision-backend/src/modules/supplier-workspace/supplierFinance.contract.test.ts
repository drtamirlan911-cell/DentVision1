import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const dashboard = read('dentvision-backend/src/modules/supplier-workspace/supplierDashboard.ts');
const routes = read('dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts');
const ui = read('src/pages/supplier/SupplierWorkspace.tsx');

describe('Supplier finance availability contract', () => {
  it('uses payout-aware available balance while preserving the full accounting balance', () => {
    expect(dashboard).toContain("import { availableBalanceMinor } from '../finance/payout.service.js'");
    expect(dashboard).toContain('availableBalanceMinor(wallet.id)');
    expect(dashboard).toContain('balanceMinor: availableBalance.toString()');
    expect(dashboard).toContain('accountingBalanceMinor: wallet.balance.toString()');
    expect(dashboard).toContain("where: { walletId: wallet.id }");
    expect(dashboard).toContain('payouts: payouts.map((payout)');
  });

  it('loads payout history only for the active supplier wallet', () => {
    const start = routes.indexOf("supplierWorkspaceRouter.get('/dashboard'");
    const end = routes.indexOf("supplierWorkspaceRouter.get('/insights'", start);
    const route = routes.slice(start, end);
    expect(route).toContain('buildSupplierDashboard(req.user!.supplierId!)');
    expect(route).toContain('serializeBigInt(data)');
    expect(route).not.toContain('req.query.supplierId');
  });

  it('shows accounting and withdrawable balances separately and submits only available funds', () => {
    expect(ui).toContain('isPositiveMinor(kpis.balanceMinor)');
    expect(ui).toContain('const balanceMinor = String(kpis.balanceMinor ??');
    expect(ui).toContain('requestPayout(token, { amountMinor: balanceMinor })');
    expect(ui).toContain('Учётный баланс');
    expect(ui).toContain('Доступно к выплате');
    expect(ui).toContain('История выплат');
    expect(ui).toContain('(dash.payouts as any[]).slice(0, 10).map');
  });
});
