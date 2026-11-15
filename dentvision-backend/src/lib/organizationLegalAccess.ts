import prisma from './prisma.js';

/**
 * Organization-scoped authority to create or sign legal documents for an
 * organization. Membership, generic ADMIN and clinic operational roles do not
 * implicitly grant legal signing authority.
 */
export function organizationLegalOwnerRoleKeys(orgType: string): string[] {
  switch (String(orgType || '').toUpperCase()) {
    case 'CLINIC': return ['owner', 'org_owner'];
    case 'DIAGNOSTIC_CENTER': return ['diagnostic_owner'];
    case 'LABORATORY': return ['medical_lab_owner', 'dental_lab_owner'];
    case 'SUPPLIER_COMPANY':
    case 'SUPPLIER': return ['seller'];
    case 'ACADEMY': return ['lecturer'];
    case 'EMPLOYER': return ['employer_owner'];
    case 'PARTNER': return ['org_owner'];
    default: return [];
  }
}

export async function hasOrganizationLegalOwnerAuthority(
  userId: string,
  organizationId: string,
  organizationType: string,
): Promise<boolean> {
  const roleKeys = organizationLegalOwnerRoleKeys(organizationType);
  if (!roleKeys.length) return false;
  const assignment = await prisma.personRole.findFirst({
    where: {
      scopeType: 'organization',
      scopeId: organizationId,
      person: { userId, organizationId },
      role: { key: { in: roleKeys } },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}
