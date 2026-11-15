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
    // Supplier legal authority is derived from SupplierMember.role === owner;
    // `seller` is the operational PersonRole shared by supplier staff.
    // Academy lecturers are operational instructors, not legal owners.
    // The canonical Academy.ownerId field is checked separately below.
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
  if (['SUPPLIER_COMPANY', 'SUPPLIER'].includes(String(organizationType || '').toUpperCase())) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { originalType: true, originalId: true },
    });
    if (organization?.originalType !== 'Supplier' || !organization.originalId) return false;
    const membership = await prisma.supplierMember.findUnique({
      where: { userId_supplierId: { userId, supplierId: organization.originalId } },
      select: { role: true },
    });
    if (String(membership?.role || '').toLowerCase() !== 'owner') return false;
    const person = await prisma.person.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!person) return false;
    const scopedSeller = await prisma.personRole.findFirst({
      where: {
        personId: person.id,
        scopeType: 'organization',
        scopeId: organizationId,
        role: { key: 'seller' },
      },
      select: { id: true },
    });
    return Boolean(scopedSeller);
  }

  if (String(organizationType || '').toUpperCase() === 'ACADEMY') {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { originalType: true, originalId: true },
    });
    if (organization?.originalType !== 'Academy' || !organization.originalId) return false;
    const academy = await prisma.academy.findUnique({
      where: { id: organization.originalId },
      select: { ownerId: true },
    });
    if (academy?.ownerId !== userId) return false;
    const person = await prisma.person.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!person) return false;
    const scopedLecturer = await prisma.personRole.findFirst({
      where: {
        personId: person.id,
        scopeType: 'organization',
        scopeId: organizationId,
        role: { key: 'lecturer' },
      },
      select: { id: true },
    });
    return Boolean(scopedLecturer);
  }

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
