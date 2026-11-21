import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261121180000_dental_lab_service_catalog/migration.sql');

describe('dental laboratory service catalogue contract', () => {
  it('stores an independent catalogue and immutable case price snapshots', () => {
    expect(schema).toContain('model DentalLabService');
    expect(schema).toContain('serviceNameSnapshot  String?');
    expect(schema).toContain('servicePriceSnapshot Int?');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_services"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "servicePriceSnapshot" INTEGER');
  });

  it('scopes catalogue management to active laboratory manager roles', () => {
    const create = routes.slice(routes.indexOf("labPlatformRouter.post('/services'"), routes.indexOf("labPlatformRouter.patch('/services/:id'"));
    expect(create).toContain('resolveLab(req)');
    expect(create).toContain('isLabManagerRole(membership.role)');
    expect(create).toContain('membership.labId');
    expect(routes).toContain("labPlatformRouter.get('/available-laboratories/:id/services'");
  });

  it('snapshots the selected partner price but does not recognize any fee at assignment', () => {
    const assign = routes.slice(routes.indexOf("labPlatformRouter.post('/assign'"));
    expect(assign).toContain('tx.dentalLabService.findFirst');
    expect(assign).toContain('serviceNameSnapshot: selectedService.name');
    expect(assign).toContain('servicePriceSnapshot: selectedService.defaultPrice');
    expect(assign).toContain('price: selectedService.defaultPrice');
    expect(assign).not.toContain('recordPartnerEconomics(');
    expect(assign).not.toContain('wallet.update(');
  });
});
