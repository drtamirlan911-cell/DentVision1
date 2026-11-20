import prisma from './prisma.js';
import { PERSON_ROLE_MAP } from './orgContext.js';
import type { RoleScope } from './roleAccessRegistry.js';

export type ClinicBranchScope = Extract<RoleScope, 'ORGANIZATION' | 'BRANCH' | 'ASSIGNED'>;

export interface ClinicBranchAccess {
  roleScope: ClinicBranchScope;
  /** Verified selected branch; null means organization-wide selection. */
  branchId: string | null;
  /** Active branches the current role is permitted to select. */
  allowedBranchIds: string[];
}

export interface ClinicBranchAccessInput {
  userId: string;
  clinicId: string;
  organizationId?: string | null;
  role: string;
  /** Untrusted active-branch selector, verified against current membership. */
  requestedBranchId?: string | null;
}

interface LegacyMembership {
  role: string;
  branchId: string | null;
}

function uniqueIds(rows: Array<{ id: string }>): string[] {
  return [...new Set(rows.map((row) => String(row.id)).filter(Boolean))];
}

export function clinicBranchRoleScope(role: string): ClinicBranchScope | null {
  switch (String(role || '').trim().toUpperCase()) {
    case 'OWNER':
    case 'ADMIN':
    case 'DIRECTOR':
    case 'ACCOUNTANT':
      return 'ORGANIZATION';
    case 'MANAGER':
    case 'LAB':
    case 'INVENTORY_MANAGER':
    case 'MARKETING_MANAGER':
    case 'HR_MANAGER':
    case 'READ_ONLY':
      return 'BRANCH';
    case 'DOCTOR':
    case 'ASSISTANT':
    case 'CASHIER':
    case 'RECEPTIONIST':
    case 'RECEPTION':
      return 'ASSIGNED';
    default:
      return null;
  }
}

/** Resolve active branches through canonical BranchMember records. */
export async function resolveOrganizationBranches(
  organizationId: string,
  roleScope: RoleScope,
  person: { id: string } | null,
): Promise<string[]> {
  const rows = await prisma.branch.findMany({
    where: {
      organizationId,
      active: true,
      ...(roleScope === 'ORGANIZATION' ? {} : {
        members: { some: { personId: person?.id || '__NO_PERSON__', active: true } },
      }),
    },
    select: { id: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  return uniqueIds(rows);
}

/** Compatibility path used only when the Clinic has no canonical Organization row. */
export async function resolveLegacyClinicBranches(
  userId: string,
  clinicId: string,
  roleScope: RoleScope,
  knownMembership?: LegacyMembership | null,
): Promise<string[]> {
  if (roleScope === 'ORGANIZATION') {
    const rows = await prisma.branch.findMany({
      where: { clinicId, active: true },
      select: { id: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return uniqueIds(rows);
  }

  const membership = knownMembership ?? await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { role: true, branchId: true },
  });
  const branchId = membership?.branchId ? String(membership.branchId) : null;
  if (!branchId) return [];

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, clinicId, active: true },
    select: { id: true },
  });
  return branch?.id ? [String(branch.id)] : [];
}

function mapsToEffectiveRole(canonicalRoleKey: string, effectiveRole: string): boolean {
  const key = String(canonicalRoleKey || '').trim().toLowerCase();
  const mapped = PERSON_ROLE_MAP[key] || key.toUpperCase();
  if (mapped === effectiveRole) return true;
  // Authentication deliberately normalizes DIRECTOR to the legacy OWNER enum.
  return effectiveRole === 'OWNER' && mapped === 'DIRECTOR';
}

export async function resolveClinicBranchAccess(
  input: ClinicBranchAccessInput,
): Promise<ClinicBranchAccess | null> {
  const userId = String(input.userId || '').trim();
  const clinicId = String(input.clinicId || '').trim();
  const roleKey = String(input.role || '').trim().toUpperCase();
  const roleScope = clinicBranchRoleScope(roleKey);
  if (!userId || !clinicId || !roleScope) return null;

  // Include archived rows in the lookup so they cannot regain access through
  // a stale legacy ClinicMember record.
  const organization = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true, type: true, originalId: true, archivedAt: true },
  });

  let allowedBranchIds: string[];
  if (organization) {
    if (
      organization.archivedAt
      || String(organization.type).toUpperCase() !== 'CLINIC'
      || organization.originalId !== clinicId
    ) return null;

    if (
      input.organizationId
      && input.organizationId !== organization.id
      && input.organizationId !== clinicId
    ) return null;

    const person = await prisma.person.findFirst({
      where: { userId, organizationId: organization.id },
      select: {
        id: true,
        personRoles: {
          where: { scopeType: 'organization', scopeId: organization.id },
          select: { role: { select: { key: true } } },
        },
      },
    });
    if (!person) return null;

    const roleKeys = person.personRoles.map((entry) => String(entry.role.key || '').trim().toLowerCase());
    if (!roleKeys.some((key) => mapsToEffectiveRole(key, roleKey))) return null;
    // The historic cashier -> ADMIN UI alias is not organization authority.
    if (roleKey === 'ADMIN' && !roleKeys.some((key) => key === 'admin' || key === 'org_admin')) return null;

    allowedBranchIds = await resolveOrganizationBranches(organization.id, roleScope, person);
  } else {
    // A non-canonical clinic must not be reached through an unrelated organization context.
    if (input.organizationId && input.organizationId !== clinicId) return null;

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
      select: { role: true, branchId: true },
    }) as LegacyMembership | null;
    if (!membership) return null;

    const legacyRoleKey = String(membership.role || '').trim().toLowerCase();
    const mappedRole = PERSON_ROLE_MAP[legacyRoleKey] || legacyRoleKey.toUpperCase();
    if (mappedRole !== roleKey) return null;
    if (roleKey === 'ADMIN' && !['admin', 'org_admin'].includes(legacyRoleKey)) return null;

    allowedBranchIds = await resolveLegacyClinicBranches(userId, clinicId, roleScope, membership);
  }

  allowedBranchIds = uniqueIds(allowedBranchIds);
  const requestedBranchId = String(input.requestedBranchId || '').trim() || null;
  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) return null;

  const selectedBranchId = requestedBranchId
    || (roleScope !== 'ORGANIZATION' && allowedBranchIds.length === 1 ? allowedBranchIds[0] : null);

  // Narrow roles with multiple active memberships must explicitly select one.
  if (roleScope !== 'ORGANIZATION' && !selectedBranchId) return null;

  return { roleScope, branchId: selectedBranchId, allowedBranchIds };
}
