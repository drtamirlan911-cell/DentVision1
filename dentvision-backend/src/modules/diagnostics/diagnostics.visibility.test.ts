import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('diagnostics public visibility boundary', () => {
  it('requires explicit ecosystemVisible=true for center list/detail paths', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.service.ts'),
      'utf8',
    );

    expect(source).toContain('return (s as any).ecosystemVisible === true;');
    expect(source).toContain('if (settings.ecosystemVisible !== true) return null;');
    expect(source).not.toContain('ecosystemVisible !== false');
  });
});
