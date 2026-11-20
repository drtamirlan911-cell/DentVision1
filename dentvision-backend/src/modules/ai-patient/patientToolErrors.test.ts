import { describe, expect, it } from 'vitest';

import {
  PATIENT_TOOL_FAILURE_MESSAGE,
  toPatientSafeToolFailure,
} from './patientToolErrors.js';

describe('patient-facing tool error boundary', () => {
  it('never forwards exception details that may contain patient data', () => {
    const syntheticErrors: unknown[] = [
      new Error('SQL failed for patient: Иван Тестов, phone +7 700 000 00 00, diagnosis: pulpitis'),
      { message: 'provider response included IIN 000000000000 and clinical note' },
      'database connection failed for patient Иван Тестов',
    ];

    for (const error of syntheticErrors) {
      const payload = toPatientSafeToolFailure(error);
      const serialized = JSON.stringify(payload);

      expect(payload).toEqual({ error: PATIENT_TOOL_FAILURE_MESSAGE });
      expect(serialized).not.toContain('Иван Тестов');
      expect(serialized).not.toContain('+7 700 000 00 00');
      expect(serialized).not.toContain('000000000000');
      expect(serialized).not.toContain('pulpitis');
      expect(serialized).not.toContain('SQL');
    }
  });

  it('states that a failed lookup is not proof that the record has no data', () => {
    expect(PATIENT_TOOL_FAILURE_MESSAGE).toContain('Это не означает, что данных нет');
  });
});
