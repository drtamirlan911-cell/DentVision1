/**
 * Canonical, server-resolved scope for durable AI Employee work.
 *
 * This module is deliberately a prerequisite, not a queue-enablement switch:
 * the existing clinic task ledger remains unchanged until its schema, event,
 * approval, audit and UI contracts are migrated together.
 */

import type { AuthUser } from '../../../types/index.js';
import prisma from '../../../lib/prisma.js';
import { resolveUserPermissions } from '../../../lib/resolvePermissions.js';
import { PERSON_ROLE_MAP } from '../../../lib/orgContext.js';
import { PARTNER_ROLE_DEFINITIONS, type RoleScope } from '../../../lib/roleAccessRegistry.js';
import { resolveAiToolAccess } from './access.js';
import type { ScopeType } from '../../iam/contexts.js';

export interface AiEmployeeTaskScope {
  scopeType: ScopeType;
  /** Domain identity from the verified workspace (not the Organization PK). */
  scopeId: string;
  /** Canonical tenant id; null only for pre-canonical legacy clinics. */
  organizationId: string | null;
  /** Clinic compatibility identity; null for non-clinic workspaces. */
  clinicId: string | null;
  /** Selected branch only after revalidation against current database membership. */
  branchId: string | null;
  roleKey: string;
  roleScope: RoleScope;
  /** Current active branch membership, never copied from JWT branchIds. */
  allowedBranchIds: string[];
  /** Permissions resolved for this exact tenant and effective role. */
  permissions: ReadonlySet<string>;
}

type ActiveOrganization = {
  id: string;
  type: string;
  originalId: string | null;
};

export type ActivePerson = {
  id: string;
  personType: string;
  originalId: string | null;
  personRoles: Array<{ role: { key: string } }>;
};

const ORGANIZATION_SCOPE_TYPES: Record<string, ScopeType> = {
  CLINIC: 'CLINIC',
  DIAGNOSTIC_CENTER: 'DIAGNOSTIC_CENTER',
  LABORATORY: 'LABORATORY',
  SUPPLIER_COMPANY: 'SUPPLIER',
  SUPPLIER: 'SUPPLIER',
  ACADEMY: 'ACADEMY',
  PARTNER: 'PARTNER',
  EMPLOYER: 'EMPLOYER',
};

/**
 * Partner roles use the canonical role registry. The legacy clinic mapping
 * mirrors branches.routes.ts roleScope() and is intentionally not reused for
 * partner roles that have an explicit definition above.
 */
function roleScopeFor(roleKey: string, scopeType: ScopeType): RoleScope | null {
  const partnerDefinition = PARTNER_ROLE_DEFINITIONS.find(
    (definition) => definition.key.toUpperCase() === roleKey,
  );
  if (partnerDefinition) return partnerDefinition.defaultScope;

  if (scopeType === 'CLINIC') {
    if (roleKey === 'OWNER' || roleKey === 'ADMIN') return 'ORGANIZATION';
    if (roleKey === 'MANAGER') return 'BRANCH';
    if (['DOCTOR', 'ASSISTANT', 'CASHIER', 'RECEPTIONIST'].includes(roleKey)) return 'ASSIGNED';
  }

  // Unknown workspace/role combinations have no queue scope until a
  // canonical role policy is added and reviewed.
  return null;
}

function uniqueIds(rows: Array<{ id: string }>): string[] {
  return [...new Set(rows.map((row) => String(row.id)).filter(Boolean))];
}

export async function resolveOrganizationBranches(
  organizationId: string,
  roleScope: RoleScope,
  person: ActivePerson | null,
): Promise<string[]> {
  if (roleScope === 'ORGANIZATION') {
    const rows = await prisma.branch.findMany({
      where: { organizationId, active: true },
      select: { id: true },
    });
    return uniqueIds(rows);
  }

  if (!person) return [];
  const rows = await prisma.branch.findMany({
    where: {
      organizationId,
      active: true,
      members: { some: { personId: person.id, active: true } },
    },
    select: { id: true },
  });
  return uniqueIds(rows);
}

export async function resolveLegacyClinicBranches(
  userId: string,
  clinicId: string,
  roleScope: RoleScope,
): Promise<string[]> {
  if (roleScope === 'ORGANIZATION') {
    const rows = await prisma.branch.findMany({
      where: { clinicId, active: true },
      select: { id: true },
    });
    return uniqueIds(rows);
  }

  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { branchId: true },
  });
  const branchId = membership?.branchId ? String(membership.branchId) : null;
  if (!branchId) return [];

  // ClinicMember.branchId is a compatibility source, not proof that the
  // referenced branch still exists or remains active in this clinic.
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, clinicId, active: true },
    select: { id: true },
  });
  return branch?.id ? [String(branch.id)] : [];
}

/**
 * Resolves the task scope from authenticated identity and live IAM records.
 *
 * A branch claim is only a requested selection: it must match a currently
 * active Branch/BranchMember (or legacy ClinicMember) relation. branchIds is
 * intentionally ignored. Platform-wide task scope is denied until a distinct
 * platform task policy is designed and tested.
 */
export async function resolveAiEmployeeTaskScope(user: AuthUser): Promise<AiEmployeeTaskScope | null> {
  if (!user?.id || user.isGuest) return null;

  const access = await resolveAiToolAccess({
    userId: user.id,
    clinicId: user.clinicId,
    organizationId: user.organizationId,
    organizationType: user.organizationType,
    supplierId: user.supplierId,
    lecturerId: user.lecturerId,
    isGuest: user.isGuest,
  });

  if (!access || access.role === 'GUEST' || access.role === 'SUPERADMIN') return null;
  if (!access.clinicId && !access.organizationId) return null;

  const roleKey = String(access.role || '').trim().toUpperCase();
  if (!roleKey) return null;

  let organization: ActiveOrganization | null = null;
  let person: ActivePerson | null = null;

  if (access.organizationId) {
    organization = await prisma.organization.findFirst({
      where: { id: access.organizationId, archivedAt: null },
      select: { id: true, type: true, originalId: true },
    });
    // Do not fall back to a legacy membership when a canonical tenant is
    // missing or archived. IAM has already verified the caller's membership.
    if (!organization) return null;

    person = await prisma.person.findFirst({
      where: { userId: user.id, organizationId: organization.id },
      select: {
        id: true,
        personType: true,
        originalId: true,
        personRoles: {
          where: { scopeType: 'organization', scopeId: organization.id },
          select: { role: { select: { key: true } } },
        },
      },
    });
    // Canonical Organization work requires a current Person row and a current
    // organization-scoped role (or a role explicitly represented by PersonType).
    // Legacy supplier/lecturer compatibility must not silently widen task scope.
    if (!person) return null;
    const hasCurrentRole = person.personRoles.some((entry) => {
      const canonicalKey = String(entry.role.key || '').trim().toLowerCase();
      // Clinic IAM intentionally normalizes legacy/canonical role aliases
      // (for example org_admin → ADMIN). Partner roles retain their exact
      // registry key. Validate against that same mapping, not a second policy.
      return (PERSON_ROLE_MAP[canonicalKey] || canonicalKey.toUpperCase()) === roleKey;
    });
    if (!hasCurrentRole) return null;
  }

  const scopeType: ScopeType | null = access.clinicId
    ? 'CLINIC'
    : person?.personType.toUpperCase() === 'LECTURER' || roleKey === 'LECTURER'
      ? 'LECTURER'
      : organization
        ? ORGANIZATION_SCOPE_TYPES[String(organization.type).toUpperCase()] || null
        : null;
  if (!scopeType) return null;

  const clinicId = access.clinicId
    || (scopeType === 'CLINIC' && organization?.type.toUpperCase() === 'CLINIC' ? organization.originalId : null);
  const organizationId = organization?.id || null;
  const scopeId = scopeType === 'CLINIC'
    ? clinicId || organization?.originalId || organization?.id || null
    : scopeType === 'LECTURER'
      ? person?.originalId || access.lecturerId || organization?.originalId || organization?.id || null
      : organization?.originalId || organization?.id || null;
  if (!scopeId) return null;

  const roleScope = roleScopeFor(roleKey, scopeType);
  if (!roleScope) return null;
  const tenantId = organizationId || clinicId;
  if (!tenantId) return null;

  const permissions = new Set(
    await resolveUserPermissions(user.id, tenantId, roleKey),
  );

  const allowedBranchIds = organizationId
    ? await resolveOrganizationBranches(organizationId, roleScope, person)
    : clinicId
      ? await resolveLegacyClinicBranches(user.id, clinicId, roleScope)
      : [];

  // branchId/assignedBranchId are untrusted selectors. branchIds is ignored
  // entirely and can never widen the DB-resolved set.
  const requestedBranchId = user.branchId || user.assignedBranchId || null;
  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) return null;

  const selectedBranchId = requestedBranchId
    || (roleScope !== 'ORGANIZATION' && allowedBranchIds.length === 1 ? allowedBranchIds[0] : null);

  // Null branch scope is reserved for a verified organization-wide role.
  // Branch/assigned/own roles need exactly one active selected branch; a
  // multi-branch membership without a current selection is ambiguous and denied.
  if (roleScope !== 'ORGANIZATION' && !selectedBranchId) return null;

  return {
    scopeType,
    scopeId,
    organizationId,
    clinicId,
    branchId: selectedBranchId,
    roleKey,
    roleScope,
    allowedBranchIds,
    permissions,
  };
}
