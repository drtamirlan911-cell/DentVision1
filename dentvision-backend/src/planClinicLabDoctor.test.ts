import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Two links the data did not have, and the guard that keeps them.
 *
 * `TreatmentPlan` knew only its patient. Every clinic-scoped question about a
 * plan — a funnel, a report, a count — had to be asked through `patients`, and
 * `TreatmentPlanRelease` carries its own denormalised `clinicId` for precisely
 * that reason: the release layer had to add back what the plan could not say.
 *
 * `LabOrder` did not record who ordered the work at all.
 *
 * A column is only as good as the writers that fill it, and this is the part
 * that rots: a sixth `treatmentPlan.create` added next month would silently
 * write a plan belonging to no clinic, and nothing would fail. So the test is a
 * source read over every writer rather than an assertion about one of them.
 *
 * Source-reading, in the idiom of `appMounts.test.ts` and
 * `planReleaseBoundary.test.ts`: this has to hold in CI with no database.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(HERE, '..');

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...tsFilesUnder(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Every source file that could write a plan or a lab order. */
const SOURCES = [...tsFilesUnder(join(BACKEND, 'src')), ...tsFilesUnder(join(BACKEND, 'prisma'))];

/**
 * The argument object of a call, by brace balance.
 *
 * A fixed window of following lines would have been simpler and wrong: these
 * call sites vary from four lines to thirty, and a window that overshoots picks
 * up the `clinicId` of whatever comes next — which is exactly how a writer that
 * does not set it would be reported as one that does.
 */
function callArgument(source: string, callIndex: number): string {
  const open = source.indexOf('{', callIndex);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error('unbalanced call argument');
}

function callSites(needle: string): Array<{ file: string; body: string }> {
  const found: Array<{ file: string; body: string }> = [];
  for (const file of SOURCES) {
    const source = readFileSync(file, 'utf8');
    let from = 0;
    for (;;) {
      const at = source.indexOf(needle, from);
      if (at === -1) break;
      found.push({ file: file.slice(BACKEND.length + 1), body: callArgument(source, at) });
      from = at + needle.length;
    }
  }
  return found;
}

describe('every writer of a treatment plan says which clinic it belongs to', () => {
  const creates = callSites('prisma.treatmentPlan.create(');

  it('finds the writers at all, so a passing suite means something', () => {
    expect(creates.length).toBeGreaterThanOrEqual(5);
  });

  it.each(creates.map((c) => [c.file, c.body] as const))(
    '%s sets clinicId',
    (_file, body) => {
      expect(body).toMatch(/\bclinicId\b/);
    },
  );

  it('sets it on update as well, so an old plan heals when someone edits it', () => {
    const crm = readFileSync(join(BACKEND, 'src/modules/crm/crm.routes.ts'), 'utf8');
    const update = callArgument(crm, crm.indexOf('prisma.treatmentPlan.update('));
    expect(update).toMatch(/\bclinicId\b/);
  });
});

describe('the tenant guards deliberately stay on the patient', () => {
  it('still scopes the CRM listing through patient.clinicId', () => {
    const crm = readFileSync(join(BACKEND, 'src/modules/crm/crm.routes.ts'), 'utf8');
    expect(crm).toMatch(/patient:\s*\{\s*clinicId\s*\}/);
  });
});

describe('the migration and the schema say the same thing', () => {
  const SCHEMA = readFileSync(join(BACKEND, 'prisma/schema.prisma'), 'utf8');
  const SQL = readFileSync(
    join(BACKEND, 'prisma/migrations/20260820_plan_clinic_lab_doctor/migration.sql'),
    'utf8',
  );
  const INDEX = readFileSync(join(BACKEND, 'src/index.ts'), 'utf8');

  function model(name: string): string {
    const at = SCHEMA.indexOf(`model ${name} {`);
    expect(at).toBeGreaterThan(-1);
    return SCHEMA.slice(at, SCHEMA.indexOf('\n}\n', at));
  }

  it('declares both columns as optional in the schema', () => {
    expect(model('TreatmentPlan')).toMatch(/clinicId\s+String\?/);
    expect(model('LabOrder')).toMatch(/doctorId\s+String\?/);
  });

  it('deletes neither plans nor lab orders when the clinic or user goes', () => {
    expect(model('TreatmentPlan')).toMatch(/clinic\s+Clinic\?.*onDelete:\s*SetNull/);
    expect(model('LabOrder')).toMatch(/doctor\s+User\?.*onDelete:\s*SetNull/);
    expect(SQL).toMatch(/treatment_plans_clinicId_fkey[\s\S]*?ON DELETE SET NULL/);
    expect(SQL).toMatch(/lab_orders_doctorId_fkey[\s\S]*?ON DELETE SET NULL/);
  });

  it('indexes both, since both exist to be queried by', () => {
    expect(model('TreatmentPlan')).toMatch(/@@index\(\[clinicId\]\)/);
    expect(model('LabOrder')).toMatch(/@@index\(\[doctorId\]\)/);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS "treatment_plans_clinicId_idx"/);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS "lab_orders_doctorId_idx"/);
  });

  it('guards every schema mutation for replay-safe deployment', () => {
    // The migration is deliberately wrapped in a PostgreSQL DO block so that
    // table existence can be checked before ALTER TABLE. Individual columns
    // and indexes are also explicitly idempotent, while foreign keys are
    // guarded by pg_constraint checks. Test the actual SQL structure rather
    // than splitting PL/pgSQL on semicolons (which would inspect fragments
    // that are not standalone SQL statements).
    expect(SQL).toMatch(/ALTER TABLE "treatment_plans" ADD COLUMN IF NOT EXISTS "clinicId"/);
    expect(SQL).toMatch(/ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "doctorId"/);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS "treatment_plans_clinicId_idx"/);
    expect(SQL).toMatch(/CREATE INDEX IF NOT EXISTS "lab_orders_doctorId_idx"/);
    expect(SQL).toMatch(/conname = 'treatment_plans_clinicId_fkey'/);
    expect(SQL).toMatch(/conname = 'lab_orders_doctorId_fkey'/);
  });

  it('backfills only rows that have no clinic yet', () => {
    expect(SQL).toMatch(/UPDATE "treatment_plans"[\s\S]*?tp\."clinicId" IS NULL/);
  });

  it('does not invent a doctor for lab orders that never had one', () => {
    expect(SQL).not.toMatch(/UPDATE "lab_orders"/);
  });

  it('is mirrored in the boot-time migration runner', () => {
    const at = INDEX.indexOf("runOnceMigration('plan_clinic_lab_doctor'");
    expect(at).toBeGreaterThan(-1);
    const block = INDEX.slice(at, INDEX.indexOf('\n  });', at));
    expect(block).toMatch(/ALTER TABLE "treatment_plans" ADD COLUMN IF NOT EXISTS "clinicId"/);
    expect(block).toMatch(/ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "doctorId"/);
    expect(block).toMatch(/UPDATE "treatment_plans"[\s\S]*?tp\."clinicId" IS NULL/);
    expect(block).toMatch(/treatment_plans_clinicId_idx/);
    expect(block).toMatch(/lab_orders_doctorId_idx/);
    expect(block).toMatch(/treatment_plans_clinicId_fkey/);
    expect(block).toMatch(/lab_orders_doctorId_fkey/);
  });
});
