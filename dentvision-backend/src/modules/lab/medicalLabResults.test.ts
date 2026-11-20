import { describe, expect, it } from 'vitest';
import { validateMedicalLabResultSet } from './medicalLabResults.js';

const tests = [{ id: 'cbc', name: 'Общий анализ крови' }, { id: 'glucose', name: 'Глюкоза' }];

describe('medical laboratory result completeness and order binding', () => {
  it('accepts a complete result set for every ordered test', () => {
    const result = validateMedicalLabResultSet(tests, [
      { id: 'cbc', result: '4.5', unit: '10^9/L', referenceRange: '4.0–10.0' },
      { id: 'glucose', resultText: 'В норме', flag: 'normal' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.results).toHaveLength(2);
  });

  it('rejects an empty test order', () => {
    expect(validateMedicalLabResultSet([], [{ id: 'cbc', result: '4.5' }]))
      .toMatchObject({ ok: false, code: 'NO_ORDER_TESTS' });
  });

  it('rejects partial result sets before moving the order forward', () => {
    expect(validateMedicalLabResultSet(tests, [{ id: 'cbc', result: '4.5' }]))
      .toMatchObject({ ok: false, code: 'INVALID_RESULT_SET' });
  });

  it('rejects an arbitrary or foreign test identifier', () => {
    expect(validateMedicalLabResultSet(tests, [
      { id: 'cbc', result: '4.5' },
      { id: 'other-order-test', result: '5.2' },
    ])).toMatchObject({ ok: false, code: 'UNKNOWN_TEST' });
  });

  it('rejects duplicate result identifiers', () => {
    expect(validateMedicalLabResultSet(tests, [
      { id: 'cbc', result: '4.5' },
      { id: 'cbc', result: '4.6' },
    ])).toMatchObject({ ok: false, code: 'DUPLICATE_TEST' });
  });

  it('rejects a test with no numeric or text result', () => {
    expect(validateMedicalLabResultSet(tests, [
      { id: 'cbc', result: '4.5' },
      { id: 'glucose', result: '  ', resultText: null },
    ])).toMatchObject({ ok: false, code: 'MISSING_RESULT' });
  });

  it('normalizes values without discarding a numeric zero', () => {
    const result = validateMedicalLabResultSet([{ id: 'glucose' }], [{ id: 'glucose', result: 0 }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.results[0].result).toBe('0');
  });
});
