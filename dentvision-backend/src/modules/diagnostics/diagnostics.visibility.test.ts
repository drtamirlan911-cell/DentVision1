import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { canReadDiagnosticCenterCatalog, canReadPartnerCatalog } from './diagnostics.service.js';

describe('diagnostics public visibility boundary', () => {
  it('requires an active center subscription for both private and public catalog access', () => {
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: true,
      subscriptionActive: false,
      isActiveOrganizationMember: false,
    })).toBe(false);
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: true,
      subscriptionActive: true,
      isActiveOrganizationMember: false,
    })).toBe(true);
  });

  it('allows private center catalogue access only to active organization members', () => {
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: false,
      subscriptionActive: true,
      isActiveOrganizationMember: false,
    })).toBe(false);
    expect(canReadDiagnosticCenterCatalog({
      isPubliclyVisible: false,
      subscriptionActive: true,
      isActiveOrganizationMember: true,
    })).toBe(true);
  });

  it('keeps laboratory private catalogues restricted to active members while preserving public discovery', () => {
    expect(canReadPartnerCatalog({
      isPubliclyVisible: false,
      isActiveOrganizationMember: false,
    })).toBe(false);
    expect(canReadPartnerCatalog({
      isPubliclyVisible: false,
      isActiveOrganizationMember: true,
    })).toBe(true);
    expect(canReadPartnerCatalog({
      isPubliclyVisible: true,
      isActiveOrganizationMember: false,
    })).toBe(true);
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
