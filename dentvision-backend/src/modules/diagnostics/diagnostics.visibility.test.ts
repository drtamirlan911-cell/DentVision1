import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('diagnostics public visibility boundary', () => {
  it('requires explicit ecosystemVisible=true for center list/detail paths', () => {
    const source = readFileSync(
      new URL('./diagnostics.service.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('return (s as any).ecosystemVisible === true;');
    expect(source).toContain('if (settings.ecosystemVisible !== true) return null;');
    expect(source).not.toContain('ecosystemVisible !== false');
  });
});
