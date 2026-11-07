import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts'),
  'utf8',
);

describe('patient portal medical-history write contract', () => {
  it('encrypts only structured object history and rejects scalar/array roots', () => {
    expect(source).toContain('isStructuredMedicalHistoryRoot');
    expect(source).toContain('history !== null && !isStructuredMedicalHistoryRoot(history)');
    expect(source).toContain('data.medicalHistory = encryptMedicalHistory(history)');
    expect(source).toContain("Передайте медицинскую историю в исходном формате");
    expect(source).toContain("Медицинская история должна быть объектом");
  });
});
