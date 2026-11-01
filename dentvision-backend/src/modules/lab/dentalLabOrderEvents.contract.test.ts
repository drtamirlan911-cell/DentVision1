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
    const start = partner.indexOf('async function appendEvent');
    const end = partner.indexOf('async function ordersForLab', start);
    expect(partner.slice(start, end)).toContain('await ensureDentalLabOrderEventsTable()');
  });

  it('has a forward migration for existing historical tables', () => {
    const migration = read('dentvision-backend/prisma/migrations/20261101090000_reconcile_dental_lab_order_events/migration.sql');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "note" TEXT');
    expect(migration).toContain('ALTER COLUMN "fromStatus" DROP NOT NULL');
  });
});
