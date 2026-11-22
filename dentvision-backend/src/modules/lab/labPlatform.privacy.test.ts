import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeErrorKind } from '../../lib/safeError.js';

const routes = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/lab/labPlatform.routes.ts'),
  'utf8',
);

describe('Laboratory route privacy logging', () => {
  it('classifies Error objects without serializing patient or clinical details', () => {
    const result = safeErrorKind(new Error(
      'Patient Dana Example, phone +7 701 555 0101, diagnosis private pulpitis',
    ));
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

  it('never writes raw exceptions from partner laboratory routes to operational logs', () => {
    const logLines = routes.split('\n').filter((line) => line.includes('console.error('));
    expect(logLines).toHaveLength(16);
    expect(routes).toContain("import { safeErrorKind } from '../../lib/safeError.js';");
    for (const line of logLines) {
      expect(line).toContain('safeErrorKind(error)');
      expect(line).not.toMatch(/,\s*error\s*\)/);
    }
  });
});
