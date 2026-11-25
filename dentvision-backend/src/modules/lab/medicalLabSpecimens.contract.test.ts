import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/lab/medicalLab.routes.ts');
const migration = read('dentvision-backend/prisma/migrations/20261121160000_medical_lab_accession_chain_of_custody/migration.sql');

describe('medical laboratory specimen custody contract', () => {
  it('keeps physical samples and events attached to the canonical order and lab', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "medical_lab_specimens"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "medical_lab_specimen_events"');
    expect(migration).toContain('FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"');
    expect(migration).toContain('FOREIGN KEY ("labId") REFERENCES "laboratories"');
    expect(migration).toContain('FOREIGN KEY ("parentSpecimenId") REFERENCES "medical_lab_specimens"');
  });

  it('requires specimen accession and barcode intake for new lab orders', () => {
    expect(routes).toContain("next === 'sample_collected'");
    expect(routes).toContain("next === 'received'");
    expect(routes).toContain('MEDICAL_LAB_ACCESSION_REQUIRED');
    expect(routes).toContain('MEDICAL_LAB_SPECIMEN_SCAN_REQUIRED');
    expect(routes).toContain("'/orders/:id/specimens/scan'");
    expect(routes).toContain('MEDICAL_LAB_CUSTODY_INCOMPLETE');
  });

  it('creates independently tracked aliquots with parent specimen lineage', () => {
    expect(routes).toContain("'/orders/:id/specimens/:specimenId/aliquots'");
    expect(routes).toContain('parentSpecimenId');
    expect(routes).toContain('ALIQUOT_CREATED');
  });
});