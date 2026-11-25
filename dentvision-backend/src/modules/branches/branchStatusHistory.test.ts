import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/branches/branchStatusHistory.ts'),
  'utf8',
);
const startup = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/index.ts'),
  'utf8',
);
const migration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261123110000_branch_status_history/migration.sql'),
  'utf8',
);

describe('partner branch status history billing boundary', () => {
  it('selects the last branch status effective at the requested period start', () => {
    expect(source).toContain('e."effective_at" <= ${periodStart}');
    expect(source).toContain('ORDER BY e."effective_at" DESC, e."id" DESC');
    expect(source).toContain('period_state ON period_state."active" = true');
    expect(source).toContain('WHERE b."organization_id" = ${organizationId}');
  });

  it('rejects pre-baseline and future periods rather than using the current roster', () => {
    expect(source).toContain('periodStart.getTime() < baselineAt.getTime()');
    expect(source).toContain('periodStart.getTime() > asOf.getTime()');
    expect(source).toContain('BranchStatusHistoryUnavailableError');
  });

  it('serializes initial baseline creation and appends status events with explicit actor/source', () => {
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('ON CONFLICT ("organization_id") DO NOTHING');
    expect(source).toContain('recordOrganizationBranchStatusEvent');
    expect(source).toContain('clock_timestamp()');
  });
  it('provisions branch history before the API listener and keeps the deployment SQL idempotent', () => {
    const migrationStart = startup.indexOf("runOnceMigration('branch_status_history'");
    const migrationEnd = startup.indexOf('// Bind the HTTP listener', migrationStart);
    const branchHistoryBootstrap = startup.slice(migrationStart, migrationEnd);

    expect(migrationStart).toBeGreaterThanOrEqual(0);
    expect(migrationEnd).toBeGreaterThan(migrationStart);
    expect(branchHistoryBootstrap).toContain('CREATE TABLE IF NOT EXISTS "branch_status_history_baselines"');
    expect(branchHistoryBootstrap).toContain('CREATE TABLE IF NOT EXISTS "branch_status_events"');
    expect(branchHistoryBootstrap).toContain('branch_status_events_organization_id_fkey');
    expect(branchHistoryBootstrap).toContain('branch_status_events_baseline_unique_idx');
    expect(branchHistoryBootstrap).not.toContain('DO $');
    expect(migration).not.toContain('DO $');
    expect(migration).toContain('branch_status_events_baseline_unique_idx');
    expect(migration).toContain('ON CONFLICT DO NOTHING');
    expect(migrationStart).toBeLessThan(startup.indexOf("app.listen(env.PORT"));
  });

});
