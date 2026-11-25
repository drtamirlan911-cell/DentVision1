import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261125090000_dental_lab_material_lots_and_case_consumption/migration.sql');
const authorization = read('dentvision-backend/src/modules/lab/labPlatform.authorization.ts');
const frontend = read('src/pages/diagnostics/DentalLabPlatform.tsx');
const materialUi = read('src/pages/diagnostics/DentalLabMaterialsTab.tsx');
const api = read('src/utils/labPlatformApi.ts');
const ci = read('.github/workflows/ci.yml');

describe('dental laboratory material traceability schema', () => {
  it('keeps laboratory materials, lots and case consumption separate from clinic inventory', () => {
    expect(schema).toContain('model DentalLabMaterial {');
    expect(schema).toContain('model DentalLabMaterialLot {');
    expect(schema).toContain('model DentalLabCaseMaterial {');
    expect(schema).toContain('dentalLabMaterialConsumptions DentalLabCaseMaterial[]');
    expect(schema).toContain('dentalMaterials DentalLabMaterial[]');
    expect(schema).toContain('minimumStockMilli BigInt');
    expect(schema).toContain('receivedQuantityMilli BigInt');
    expect(schema).toContain('remainingQuantityMilli BigInt');
    expect(schema).toContain('totalCostMinorSnapshot BigInt');
    expect(schema).toContain('@@unique([labId, idempotencyKey])');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_materials"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_material_lots"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_case_materials"');
    expect(migration).toContain('CHECK ("remainingQuantityMilli" >= 0 AND "remainingQuantityMilli" <= "receivedQuantityMilli")');
    expect(migration).toContain('FOREIGN KEY ("materialId", "labId")');
    expect(migration).toContain('FOREIGN KEY ("lotId", "labId")');
    expect(schema).toContain('model InventoryItem {');
  });

  it('registers the additive migration in the isolated E2E database bootstrap', () => {
    expect(ci).toContain('Apply dental laboratory material lots and case consumption');
    expect(ci).toContain('20261125090000_dental_lab_material_lots_and_case_consumption/migration.sql');
  });
});

describe('dental laboratory material authorization', () => {
  it('scopes catalog and lot intake to the active Laboratory membership', () => {
    const readRoute = routes.slice(routes.indexOf("labPlatformRouter.get('/materials'"), routes.indexOf("labPlatformRouter.post('/materials'"));
    const createRoute = routes.slice(routes.indexOf("labPlatformRouter.post('/materials'"), routes.indexOf("labPlatformRouter.post('/materials/:id/lots'"));
    const receiveRoute = routes.slice(routes.indexOf("labPlatformRouter.post('/materials/:id/lots'"), routes.indexOf("labPlatformRouter.get('/orders/:id/material-consumptions'"));
    expect(readRoute).toContain('resolveLab(req)');
    expect(readRoute).toContain('where: { labId: membership.labId');
    expect(readRoute).toContain('...(manager ? { unitCostMinor: lot.unitCostMinor.toString(), currency: lot.currency } : {})');
    expect(createRoute).toContain('isLabManagerRole(membership.role)');
    expect(createRoute).toContain('labId: membership.labId');
    expect(receiveRoute).toContain('isLabManagerRole(membership.role)');
    expect(receiveRoute).toContain('id: materialId, labId: membership.labId, active: true');
  });

  it('allows only assigned technicians or managers to consume against their own lab order', () => {
    const route = routes.slice(routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions'"), routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions/:consumptionId/reversal'"));
    expect(route).toContain('isLabTechnicianRole(membership.role)');
    expect(route).toContain('labMemberOrderReadScope');
    expect(route).toContain("metaOf(order.files).laboratoryId !== membership.labId");
    expect(route).toContain('meta.technicianId !== req.user!.id');
    expect(route).toContain('labOrderId: orderId');
    expect(authorization).toContain('files: { path: [\'meta\', \'technicianId\'], equals: input.userId }');
    expect(frontend).toContain('canConsume={canConsumeMaterials}');
    expect(frontend).toContain("['lab_coordinator', 'qc_specialist', 'technician'");
  });

  it('locks the order and selected lot, rejects expired/insufficient stock, and decrements conditionally', () => {
    const route = routes.slice(routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions'"), routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions/:consumptionId/reversal'"));
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain('lot.expiresAt.getTime() <= Date.now()');
    expect(route).toContain('lot.remainingQuantityMilli < quantityMilli');
    expect(route).toContain('remainingQuantityMilli: { gte: quantityMilli }');
    expect(route).toContain('remainingQuantityMilli: { decrement: quantityMilli }');
    expect(route).toContain('payloadFingerprint: fingerprint');
    expect(route).toContain('unitCostMinorSnapshot: lot.unitCostMinor');
    expect(route).toContain('totalCostMinorSnapshot');
    expect(route).toContain('LAB_MATERIAL_INSUFFICIENT_STOCK');
    expect(route).toContain('LAB_MATERIAL_LOT_EXPIRED');
  });

  it('uses an idempotent key per laboratory and refuses conflicting replays', () => {
    const route = routes.slice(routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions'"), routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions/:consumptionId/reversal'"));
    expect(route).toContain('where: { labId_idempotencyKey: { labId: membership.labId, idempotencyKey } }');
    expect(route).toContain("prior.payloadFingerprint === fingerprint");
    expect(route).toContain('LAB_MATERIAL_IDEMPOTENCY_CONFLICT');
    expect(schema).toContain('@@unique([labId, idempotencyKey])');
  });

  it('restricts reversal to managers and restores only the exact source lot', () => {
    const route = routes.slice(routes.indexOf("labPlatformRouter.post('/orders/:id/material-consumptions/:consumptionId/reversal'"), routes.indexOf("labPlatformRouter.get('/dashboard'"));
    expect(route).toContain('isLabManagerRole(membership.role)');
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain('remainingQuantityMilli: { increment: row.quantityMilli }');
    expect(route).toContain('reversedByUserId: req.user!.id');
    expect(route).toContain('reversalReason: reason');
    expect(route).toContain("action: 'DENTAL_LAB_MATERIAL_CONSUMPTION_REVERSED'");
  });

  it('exposes the material workspace without changing service price or commission accounting', () => {
    expect(frontend).toContain("id: 'materials', label: 'Материалы'");
    expect(frontend).toContain('DentalLabMaterialsTab');
    expect(api).toContain('receiveDentalLabMaterialLot');
    expect(api).toContain('consumeDentalLabOrderMaterial');
    expect(materialUi).toContain('Партии с истёкшим сроком годности');
    expect(routes).toContain("action: 'DENTAL_LAB_MATERIAL_CONSUMED'");
    expect(routes).not.toContain('recordPartnerEconomics({ vertical: \'DENTAL_LAB\', grossMinor: totalCostMinorSnapshot');
  });
});
