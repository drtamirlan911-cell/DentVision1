import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('dental lab order event schema contract', () => {
  it('repairs both legacy DDL differences and permits a null origin status', () => {
    const helper = read('dentvision-backend/src/modules/lab/dentalLabOrderEvents.ts');
    expect(helper).toContain('"fromStatus" TEXT,');
    expect(helper).toContain('"note" TEXT,');
    expect(helper).toContain('ADD COLUMN IF NOT EXISTS "note" TEXT');
    expect(helper).toContain('ALTER COLUMN "fromStatus" DROP NOT NULL');
  });

  it('uses one shared bootstrap for clinic and partner event writers', () => {
    const clinic = read('dentvision-backend/src/modules/lab/lab.routes.ts');
    const partner = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
    expect(clinic).toContain("import { ensureDentalLabOrderEventsTable } from './dentalLabOrderEvents.js'");
    expect(clinic).toContain('await ensureDentalLabOrderEventsTable()');
    expect(partner).toContain("import { ensureDentalLabOrderEventsTable } from './dentalLabOrderEvents.js'");
    const writerStart = partner.indexOf('async function appendEventInTransaction');
    const writerEnd = partner.indexOf('function serialize', writerStart);
    const writer = partner.slice(writerStart, writerEnd);
    expect(writer).toContain('tx.$executeRawUnsafe');

    const eventRoutes = [
      "labPlatformRouter.post('/assign'",
      "labPlatformRouter.patch('/orders/:id/status'",
      "labPlatformRouter.patch('/orders/:id/technician'",
      "labPlatformRouter.patch('/orders/:id/qc'",
    ];
    for (const routeStart of eventRoutes) {
      const start = partner.indexOf(routeStart);
      const end = partner.indexOf('\\n});', start);
      const route = partner.slice(start, end);
      const bootstrap = route.indexOf('await ensureDentalLabOrderEventsTable()');
      const transaction = route.indexOf('prisma.$transaction');
      expect(start, routeStart).toBeGreaterThanOrEqual(0);
      expect(bootstrap, routeStart).toBeGreaterThanOrEqual(0);
      expect(transaction, routeStart).toBeGreaterThan(bootstrap);
    }
  });

  it('has a forward migration for existing historical tables', () => {
    const migration = read('dentvision-backend/prisma/migrations/20261101090000_reconcile_dental_lab_order_events/migration.sql');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "note" TEXT');
    expect(migration).toContain('ALTER COLUMN "fromStatus" DROP NOT NULL');
  });
});
