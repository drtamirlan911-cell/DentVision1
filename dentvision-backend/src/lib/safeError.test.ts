import { describe, expect, it } from 'vitest';
import { safeErrorKind } from './safeError.js';

describe('safeErrorKind — PHI-free operational classification', () => {
  it('classifies Error objects without returning message, stack or payload', () => {
    const error = new Error(
      'Patient Dana Example, phone +7 701 555 0101, diagnosis private pulpitis',
    );

    const result = safeErrorKind(error);

    expect(result).toBe('Error');
    expect(JSON.stringify(result)).not.toContain('Dana Example');
    expect(JSON.stringify(result)).not.toContain('+7 701 555 0101');
    expect(JSON.stringify(result)).not.toContain('private pulpitis');
  });

  it('classifies non-Error throws without serializing their value', () => {
    const result = safeErrorKind('Patient Dana Example +7 701 555 0101');

    expect(result).toBe('NonError');
    expect(JSON.stringify(result)).not.toContain('Dana Example');
    expect(JSON.stringify(result)).not.toContain('+7 701 555 0101');
  });
});
