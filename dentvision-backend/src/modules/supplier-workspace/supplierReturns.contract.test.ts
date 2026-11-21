import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts');
const dashboard = read('dentvision-backend/src/modules/supplier-workspace/supplierDashboard.ts');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261121210000_supplier_dispute_response/migration.sql');
const ui = read('src/pages/supplier/SupplierWorkspace.tsx');
const api = read('src/utils/api.ts');
describe('supplier return response boundary', () => {
  it('stores one supplier-scoped response linked to dispute and order', () => {
    expect(schema).toContain('model SupplierDisputeResponse');
    expect(schema).toContain('@@unique([disputeId, supplierId])');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "supplier_dispute_responses"');
    expect(migration).toContain('"disputeId"');
  });
  it('requires the active supplier write role and verifies ownership of an order line', () => {
    expect(routes).toContain("supplierWorkspaceRouter.post('/returns/:id/respond', requireSupplierWrite");
    expect(routes).toContain('supplierOwnsOrderLine(supplierId, dispute.refId, tx)');
    expect(routes).toContain('orderHasSupplierLine(order.items, supplierId, productIds)');
    expect(routes).toContain("['order', 'shop_order'].includes(refType)");
    expect(routes).toContain('ACKNOWLEDGE_RETURN_REQUEST');
    expect(routes).toContain('CONTEST_RETURN_REQUEST');
  });
  it('does not let the supplier close a platform dispute or trigger a refund', () => {
    const part = routes.slice(routes.indexOf("supplierWorkspaceRouter.post('/returns/:id/respond'"));
    const response = part.slice(0, part.indexOf("supplierWorkspaceRouter.patch('/orders/:id/status'"));
    expect(response).not.toContain('reverseCashback');
    expect(response).not.toContain('dispute.update');
    expect(response).not.toContain('dispute.updateMany');
    expect(response).toContain('writeAuditLog');
    expect(response).toContain('idempotent: true');
    expect(response).toContain('FOR UPDATE');
    expect(response).toContain('}, tx);');
  });
  it('returns only disputes attached to supplier-owned orders/products and scopes responses to this supplier', () => {
    expect(dashboard).toContain('const disputeScope');
    expect(dashboard).toContain('where: { OR: disputeScope }');
    expect(dashboard).toContain('where: { supplierId }');
    expect(dashboard).toContain('supplierResponses');
  });
  it('wires an audited response composer into the supplier workspace', () => {
    expect(api).toContain('respondToReturn');
    expect(ui).toContain('handleSupplierDisputeResponse');
    expect(ui).toContain('supplierWs.respondToReturn');
    expect(ui).toContain('не списывает средства');
  });
});
