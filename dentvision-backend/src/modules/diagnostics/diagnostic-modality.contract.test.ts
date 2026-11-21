import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const schema = read('dentvision-backend/prisma/schema.prisma');
const service = read('dentvision-backend/src/modules/diagnostics/diagnostics.service.ts');
const migration = read('dentvision-backend/prisma/migrations/20261121140000_diagnostic_modality_registry/migration.sql');

describe('diagnostic modality and worklist contract', () => {
  it('models center-owned equipment and optional referral assignment with safe deletion', () => {
    expect(schema).toContain('model DiagnosticModality');
    expect(schema).toMatch(/center\s+DiagnosticCenter @relation\(fields: \[centerId\], references: \[id\], onDelete: Cascade\)/);
    expect(schema).toMatch(/modality\s+DiagnosticModality\? @relation\(fields: \[modalityId\], references: \[id\], onDelete: SetNull\)/);
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "diagnostic_modalities"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "modalityId"');
  });

  it('limits the worklist projection to operational fields and does not expose IIN or contact data', () => {
    const worklist = service.slice(
      service.indexOf('export async function getDiagnosticCenterWorklist'),
      service.indexOf('// ─── Referrals ───'),
    );
    expect(worklist).toContain('patientName: true');
    expect(worklist).toContain('modality: { select:');
    expect(worklist).not.toContain('patientIin');
    expect(worklist).not.toContain('patientPhone');
    expect(worklist).not.toContain('patientEmail');
  });

  it('keeps the default worklist operational and excludes closed outcomes', () => {
    expect(service).toContain("notIn: ['COMPLETED', 'REVIEWED', 'DELIVERED', 'CLOSED', 'CANCELLED']");
    expect(service).toContain('EMERGENCY: 0, URGENT: 1, NORMAL: 2');
  });
});
