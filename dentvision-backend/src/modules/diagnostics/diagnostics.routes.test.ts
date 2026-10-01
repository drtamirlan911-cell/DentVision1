import { describe, expect, it } from 'vitest';
import { authorizeReferralListScope } from './diagnostics.routes.js';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  role: 'LAB',
  organizationId: 'org-1',
  organizationOriginalId: 'lab-1',
  organizationType: 'LABORATORY',
  ...overrides,
}) as any;

describe('diagnostics referral scope authorization', () => {
  it('allows a laboratory user to read its own laboratory scope', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-1' })).resolves.toEqual({ ok: true });
  });

  it('denies a laboratory user from another laboratory', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('does not confuse Organization.id with the underlying laboratory id', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'org-1' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('allows a diagnostic-center user only for its original center id', async () => {
    const diagnosticUser = user({
      organizationId: 'org-center',
      organizationOriginalId: 'center-1',
      organizationType: 'DIAGNOSTIC_CENTER',
    });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-1' })).resolves.toEqual({ ok: true });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к центру',
    });
  });

  it('keeps superadmin platform access explicit', async () => {
    await expect(authorizeReferralListScope(user({ role: 'SUPERADMIN', organizationId: undefined, organizationOriginalId: undefined, organizationType: undefined }), { labId: 'any-lab' })).resolves.toEqual({ ok: true });
  });
});
