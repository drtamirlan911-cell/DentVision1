import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('medical lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/medicalLab.routes.ts'), 'utf8');

  it('checks branch membership for clinic medical-lab orders', () => {
    expect(source).toContain('user?.branchIds ?? []');
    expect(source).toContain('branchId: { in: branchIds }');
    expect(source).toContain('p."branchId" = ANY(\${args.length}::text[])');
  });

  it('blocks creation from patients outside the current branch set', () => {
    expect(source).toContain('__NO_BRANCH_ACCESS__');
  });

  it('resolves laboratory scope from the original organization entity id', () => {
    expect(source).toContain('organizationOriginalId ||');
  });
});
