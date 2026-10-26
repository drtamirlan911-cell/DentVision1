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


describe('diagnostic result signing role boundary', () => {
  it('does not grant result signing to partner owner/admin/manager/quality roles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'),
      'utf8',
    );
    const start = source.indexOf("diagnosticsRouter.post('/referrals/:id/results/sign'");
    const end = source.indexOf("diagnosticsRouter.", start + 20);
    const block = source.slice(start, end > start ? end : start + 4000);
    expect(block).toContain('hasScopedPartnerSignerRole(req.user!, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS)');
    expect(block).toContain('hasScopedPartnerSignerRole(req.user!, LAB_RESULT_SIGNER_ROLE_KEYS)');
    expect(block).not.toContain('const actorRole =');
    expect(block).not.toContain("['SUPERADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(actorRole)");
  });
});
