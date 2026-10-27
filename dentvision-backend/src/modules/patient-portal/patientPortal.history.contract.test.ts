import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const patientPortalRoute = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts'),
  'utf8',
);

const patientCrudRoute = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patients/patients.routes.ts'),
  'utf8',
);

const phi = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/phi.ts'), 'utf8');
const teethStore = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/patients/teethStore.ts'), 'utf8');

describe('patient portal structured medical-history persistence contract', () => {
  it('uses the canonical JSON history envelope encoder instead of coercing history to a string', () => {
    expect(patientPortalRoute).toContain(
      "import { decryptPatientFields, encryptMedicalHistory, hmacIin, isClientSuppliedEncryptedMedicalHistory } from '../../lib/phi.js';",
    );
    expect(patientPortalRoute).toContain(
      'data.medicalHistory = encryptMedicalHistory(history);',
    );
    expect(patientPortalRoute).not.toContain('encryptField(String(body.medicalHistory))');
    expect(patientPortalRoute).toContain('if (isClientSuppliedEncryptedMedicalHistory(history))');
  });

  it('rejects caller-supplied encrypted history markers in canonical Patient create/update APIs', () => {
    expect((patientCrudRoute.match(/isClientSuppliedEncryptedMedicalHistory\(body\.medicalHistory\)/g) || [])).toHaveLength(2);
  });

  it('guards concurrent clinical-history writers with row-version predicates', () => {
    expect(patientCrudRoute).toContain('updatedAt:existing.updatedAt');
    expect(patientCrudRoute).toContain('tx.patient.updateMany');
    expect(patientPortalRoute).toContain('updatedAt: current.updatedAt');
    expect(patientPortalRoute).toContain('patient.updateMany');
    expect(teethStore).toContain('updatedAt: patient.updatedAt');
    expect(teethStore).toContain("throw new Error('PATIENT_HISTORY_CONFLICT')");
    expect(teethStore).toContain('await prisma.$transaction');
  });

  it('keeps object JSON round-tripping in the shared encrypted envelope codec', () => {
    expect(phi).toContain('export function encryptMedicalHistory(value: unknown): unknown');
    expect(phi).toContain('export function decryptMedicalHistory(value: unknown): unknown');
    expect(phi).toContain("return JSON.parse(decrypted as string) as unknown;");
  });
});
