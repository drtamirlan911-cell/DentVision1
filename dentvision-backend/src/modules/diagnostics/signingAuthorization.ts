import prisma from '../../lib/prisma.js';
import type { AuthUser } from '../../types/index.js';

// These are canonical Role.key values, not UserRole enum values. Specialized
// partner roles are deliberately normalized to the least-privileged compatible
// UserRole in auth middleware, so req.user.role cannot authorize these actions.
export const DIAGNOSTIC_RESULT_SIGNER_ROLE_KEYS = ['radiologist'] as const;
export const LAB_RESULT_SIGNER_ROLE_KEYS = ['medical_lab_validator', 'medical_lab_doctor'] as const;

export async function hasScopedPartnerSignerRole(
  user: Pick<AuthUser, 'id' | 'organizationId'>,
  allowedRoleKeys: readonly string[],
): Promise<boolean> {
  const organizationId = user.organizationId;
  if (!user.id || !organizationId || allowedRoleKeys.length === 0) return false;

  // Require both the Person's organization and an explicit organization-scoped
  // PersonRole. A platform/global role or another organization's assignment is
  // not sufficient to sign a partner diagnostic result.
  const person = await prisma.person.findFirst({
    where: {
      userId: user.id,
      organizationId,
      personRoles: {
        some: {
          scopeType: 'organization',
          scopeId: organizationId,
          role: { key: { in: [...allowedRoleKeys] } },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(person);
}
