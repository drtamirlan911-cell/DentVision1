import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
const authorization = read('dentvision-backend/src/modules/lab/labPlatform.authorization.ts');
const payoutService = read('dentvision-backend/src/modules/finance/payout.service.ts');
const api = read('src/utils/labPlatformApi.ts');
const ui = read('src/pages/diagnostics/DentalLabPlatform.tsx');

describe('Dental Laboratory Finance Hub and payout boundaries', () => {
  it('scopes wallet, available balance, payouts and economics to the resolved lab membership', () => {
    const start = routes.indexOf("labPlatformRouter.get('/finance'");
    const end = routes.indexOf("labPlatformRouter.post('/payouts'", start);
    const route = routes.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain('resolveLab(req)');
    expect(route).toContain('canLabManageFinance(membership.role)');
    expect(route).toContain("getOrCreateWallet('PARTNER', membership.labId)");
    expect(route).toContain('availableBalanceMinor(wallet.id)');
    expect(route).toContain('where: { walletId: wallet.id }');
    expect(route).toContain("vertical: 'DENTAL_LAB', partnerId: membership.labId");
    expect(route).not.toContain('req.body');
  });

  it('creates a payout request only for the active partner wallet and records an audit entry', () => {
    const start = routes.indexOf("labPlatformRouter.post('/payouts'");
    const end = routes.indexOf("labPlatformRouter.get('/orders'", start);
    const route = routes.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain('resolveLab(req)');
    expect(route).toContain('canLabManageFinance(membership.role)');
    expect(route).toContain('parseTengeToMinor(rawAmount)');
    expect(route).toContain("ownerType: 'PARTNER', ownerId: membership.labId");
    expect(route).toContain('prisma.$transaction(async (tx) =>');
    expect(route).toContain('requestPayout({ ownerType: \'PARTNER\', ownerId: membership.labId, amountMinor }, tx)');
    expect(route).toContain('DENTAL_LAB_PAYOUT_REQUESTED');
    expect(route).toContain('}, tx);');
    expect(route).toContain('PayoutError');
    expect(route).not.toContain('transitionPayout(');
    expect(route).not.toContain('tx.wallet.update(');
  });

  it('isolates finance permissions from production and logistics roles', () => {
    expect(authorization).toContain('export function canLabManageFinance');
    expect(authorization).toContain('LAB_MANAGER_ROLES.has(normalized) || LAB_FINANCE_ROLES.has(normalized)');
    expect(authorization).toContain("const LAB_FINANCE_ROLES = new Set(['lab_finance', 'finance', 'accountant'])");
    expect(authorization).toContain('return LAB_MANAGER_ROLES.has(normalized) || LAB_FINANCE_ROLES.has(normalized)');
  });

  it('notifies only members of the laboratory partner wallet when payout state changes', () => {
    const start = payoutService.indexOf('async function resolvePayoutRequesterUserIds');
    const end = payoutService.indexOf('/** Tell the person who asked', start);
    const resolver = payoutService.slice(start, end);
    expect(resolver).toContain("ownerType === 'PARTNER'");
    expect(resolver).toContain('db.laboratoryMember.findMany');
    expect(resolver).toContain('db.organization.findFirst');
    expect(resolver).toContain('db.personRole.findMany');
    expect(resolver).toContain("medical_lab_finance");
    expect(resolver).toContain("dental_lab_owner");
    expect(resolver).toContain('new Set([...legacyMembers.map');
    expect(resolver).toContain('labId: ownerId');
    expect(resolver).toContain("role: { in: ['owner', 'admin', 'manager', 'director', 'lab_manager', 'lab_finance', 'finance', 'accountant'] }");
  });

  it('wires the finance tab to server-authoritative decimal-string payout requests', () => {
    expect(api).toContain("getLabPlatformFinance = () => request<LabPlatformFinance>('/finance')");
    expect(api).toContain("requestLabPlatformPayout = (amount: string)");
    expect(ui).toContain("id: 'finance', label: 'Финансы'");
    expect(ui).toContain("effectiveTab === 'finance' && canManageFinance");
    expect(ui).toContain('function payoutAmountToMinor(value: string): bigint | null');
    expect(ui).toContain('BigInt(finance.data.availableBalanceMinor)');
    expect(ui).not.toContain('Number(finance.data.availableBalanceMinor)');
  });
});
