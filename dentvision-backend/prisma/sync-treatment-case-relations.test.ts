import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd());
const sourceSchema = path.join(repoRoot, 'dentvision-backend', 'prisma', 'schema.prisma');
const sourceSyncScript = path.join(repoRoot, 'dentvision-backend', 'prisma', 'sync-treatment-case-relations.ts');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const tempDirs: string[] = [];

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function runSync(cwd: string) {
  execFileSync(process.execPath, [tsxCli, sourceSyncScript], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

describe('TreatmentCase relation synchronizer', () => {
  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('is idempotent across repeated postinstall-style executions', () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), 'dentvision-treatment-case-'));
    tempDirs.push(fixtureDir);
    mkdirSync(path.join(fixtureDir, 'prisma'), { recursive: true });
    writeFileSync(path.join(fixtureDir, 'prisma', 'schema.prisma'), readFileSync(sourceSchema, 'utf8'), 'utf8');

    runSync(fixtureDir);
    const first = readFileSync(path.join(fixtureDir, 'prisma', 'schema.prisma'), 'utf8');
    runSync(fixtureDir);
    const second = readFileSync(path.join(fixtureDir, 'prisma', 'schema.prisma'), 'utf8');

    expect(sha256(second)).toBe(sha256(first));

    const appointmentStart = second.indexOf('model Appointment {');
    const appointmentEnd = second.indexOf('\n}\n', appointmentStart);
    const appointment = second.slice(appointmentStart, appointmentEnd);
    expect((appointment.match(/^  treatmentCase TreatmentCase\?/gm) ?? []).length).toBe(1);

    const caseStart = second.indexOf('model TreatmentCase {');
    const caseEnd = second.indexOf('\n}\n', caseStart);
    const treatmentCase = second.slice(caseStart, caseEnd);
    for (const relation of ['appointments', 'visits', 'treatmentPlans', 'referrals', 'labOrders', 'invoices']) {
      expect((treatmentCase.match(new RegExp(`^  ${relation} `, 'gm')) ?? []).length).toBe(1);
    }
  });
});
