import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: { person: { findFirst: vi.fn() } },
}));

vi.mock('../../lib/prisma.js', () => ({ default: mocks.prisma }));

import { hasScopedPartnerSignerRole, DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS, LAB_RESULT_SIGNER_ROLE_KEYS } from './signingAuthorization.js';

describe('partner diagnostic result signer authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a radiologist through the explicit organization PersonRole even when the auth enum role is DOCTOR', async () => {
    mocks.prisma.person.findFirst.mockResolvedValue({ id: 'person-radiologist-a' });

    const allowed = await hasScopedPartnerSignerRole(
      { id: 'user-a', organizationId: 'diagnostic-org-a' },
      DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS,
    );

    expect(allowed).toBe(true);
    expect(mocks.prisma.person.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-a',
        organizationId: 'diagnostic-org-a',
        personRoles: {
          some: {
            scopeType: 'organization',
            scopeId: 'diagnostic-org-a',
            role: { key: { in: ['radiologist'] } },
          },
        },
      },
      select: { id: true },
    });
  });

  it('does not grant signing authority to an owner without an explicit signer role', async () => {
    mocks.prisma.person.findFirst.mockResolvedValue(null);

    await expect(
      hasScopedPartnerSignerRole(
        { id: 'partner-owner-a', organizationId: 'diagnostic-org-a' },
        DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS,
      ),
    ).resolves.toBe(false);
  });

  it('fails closed when the active organization context is missing', async () => {
    await expect(
      hasScopedPartnerSignerRole({ id: 'user-a' }, LAB_RESULT_SIGNER_ROLE_KEYS),
    ).resolves.toBe(false);
    expect(mocks.prisma.person.findFirst).not.toHaveBeenCalled();
  });
});
