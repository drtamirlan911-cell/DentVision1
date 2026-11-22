import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts'),
  'utf8',
);
const payoutService = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/finance/payout.service.ts'),
  'utf8',
);

describe('Supplier payout request transaction contract', () => {
  it('uses the active supplier owner and atomically records payout plus audit', () => {
    const start = routes.indexOf("supplierWorkspaceRouter.post('/payouts'");
    const end = routes.indexOf("supplierWorkspaceRouter.", start + 1);
    const route = routes.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain('requireSupplierWrite');
    expect(route).toContain("ownerType: 'SUPPLIER', ownerId: req.user!.supplierId!");
    expect(route).toContain('prisma.$transaction(async (tx) =>');
    expect(route).toContain('requestPayout({ ownerType:');
    expect(route).toContain('}, tx)');
    expect(route).toContain("action: 'SUPPLIER_PAYOUT_REQUESTED'");
    expect(route).toContain('}, tx);');
    expect(route).not.toContain('req.body.ownerId');
    expect(route).not.toContain('req.body.supplierId');
  });

  it('supports a caller-owned transaction while keeping the standalone service path transactional', () => {
    expect(payoutService).toContain('export async function requestPayout(input: RequestPayoutInput, db: Db = prisma)');
    expect(payoutService).toContain('return db === prisma');
    expect(payoutService).toContain(': createRequest(db as Prisma.TransactionClient)');
    expect(payoutService).toContain('prisma.$transaction(createRequest)');
  });
});
