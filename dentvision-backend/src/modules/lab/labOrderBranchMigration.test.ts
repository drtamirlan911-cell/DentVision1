import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/migrations/20261125130000_lab_order_branch_scope/migration.sql'),
  'utf8',
);
const schema = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/prisma/schema.prisma'),
  'utf8',
);

describe('lab order branch ownership migration', () => {
  it('adds a nullable branch foreign key and indexes the scoped clinic queue', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "branch_id" TEXT');
    expect(migration).toContain('REFERENCES "branches"("id")');
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).toContain('("clinicId", "branch_id", "createdAt" DESC)');
  });

  it('guards the branch foreign key so a partially completed migration can be retried', () => {
    expect(migration).toContain('DO $lab_order_branch_fk
    expect(migration).toContain('lo."patientId" = p.id');
    expect(migration).toContain('lo."clinicId" = p."clinicId"');
    expect(migration).toContain('p.branch_id IS NOT NULL');
    expect(migration).not.toContain('WHERE lo."patientId" IS NULL');
  });

  it('enforces patient and active clinic branch consistency at the database boundary', () => {
    expect(migration).toContain('lab order patient belongs to another clinic');
    expect(migration).toContain('lab order branch is missing or inactive');
    expect(migration).toContain('lab order branch does not match patient branch');
    expect(migration).toContain("o.type = 'CLINIC'");
    expect(migration).toContain('o."originalId" = NEW."clinicId"');
    expect(migration).toContain('o."archivedAt" IS NULL');
  });
}););
    expect(migration).toContain("conname = 'lab_orders_branch_id_fkey'");
    expect(migration).toContain('conrelid = \'lab_orders\'::regclass');
    expect(migration).toContain('$lab_order_branch_fk$;');
  });

  it('keeps the Prisma branch relation and scoped queue index aligned with SQL', () => {
    expect(schema).toContain('branch  Branch?  @relation(fields: [branchId], references: [id], onDelete: Restrict)');
    expect(schema).toContain('@@index([clinicId, branchId, createdAt(sort: Desc)], map: "lab_orders_clinic_branch_created_idx")');
  });

  it('backfills only from a same-clinic patient branch and does not guess patientless history', () => {
    expect(migration).toContain('lo."patientId" = p.id');
    expect(migration).toContain('lo."clinicId" = p."clinicId"');
    expect(migration).toContain('p.branch_id IS NOT NULL');
    expect(migration).not.toContain('WHERE lo."patientId" IS NULL');
  });

  it('enforces patient and active clinic branch consistency at the database boundary', () => {
    expect(migration).toContain('lab order patient belongs to another clinic');
    expect(migration).toContain('lab order branch is missing or inactive');
    expect(migration).toContain('lab order branch does not match patient branch');
    expect(migration).toContain("o.type = 'CLINIC'");
    expect(migration).toContain('o."originalId" = NEW."clinicId"');
    expect(migration).toContain('o."archivedAt" IS NULL');
  });
});