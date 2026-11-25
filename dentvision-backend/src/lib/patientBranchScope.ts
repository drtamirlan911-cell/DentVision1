import type { Prisma } from '@prisma/client';
import prisma from './prisma.js';
import { resolveClinicBranchAccess } from './clinicBranchAccess.js';

export type PatientBranchScope =
  | { kind: 'organization'; branchIds: string[] }
  | { kind: 'branch'; branchIds: string[] }
  | { kind: 'assigned'; branchIds: string[] };

export interface PatientBranchContext {
  clinicId: string;
  userId: string;
  role: string;
  branchId: string | null;
  allowedBranchIds?: string[];
  scope: PatientBranchScope;
}

export interface PatientBranchContextOptions {
  organizationId?: string | null;
  requestedBranchId?: string | null;
}

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN']);
const BRANCH_ROLES = new Set(['MANAGER']);
const ASSIGNED_ROLES = new Set(['DOCTOR', 'ASSISTANT', 'RECEPTIONIST', 'CASHIER']);

export async function resolvePatientBranchContext(
  userId: string,
  clinicId: string,
  role: string,
  optionsOrAuthorizedBranchIds: PatientBranchContextOptions | readonly string[] = [],
  assignedBranchId?: string | null,
): Promise<PatientBranchContext> {
  if (!Array.isArray(optionsOrAuthorizedBranchIds)) {
    const options = optionsOrAuthorizedBranchIds as PatientBranchContextOptions;
    const access = await resolveClinicBranchAccess({
      userId,
      clinicId,
      organizationId: options.organizationId,
      role,
      requestedBranchId: options.requestedBranchId,
    });
    if (!access) {
      return { clinicId, userId, role, branchId: null, allowedBranchIds: [], scope: { kind: 'assigned', branchIds: [] } };
    }
    const kind = access.roleScope === 'ORGANIZATION' ? 'organization' : access.roleScope === 'BRANCH' ? 'branch' : 'assigned';
    const visibleBranchIds = access.branchId ? [access.branchId] : access.allowedBranchIds;
    return { clinicId, userId, role, branchId: access.branchId, allowedBranchIds: access.allowedBranchIds, scope: { kind, branchIds: visibleBranchIds } };
  }
  const authorizedBranchIds = optionsOrAuthorizedBranchIds;
  // Start from the branch allow-list rebuilt by authenticate from canonical
  // BranchMember + active legacy assignments. Recheck the exact legacy clinic
  // membership here as a compatibility path for older E2E/deployed sessions
  // whose claim did not yet hydrate branchIds. Archived branches never enter it.
  const membership = await prisma.$queryRaw<Array<{
    branch_id: string | null;
    branch_active: boolean;
  }>>`
    SELECT cm."branch_id",
      CASE WHEN cm."branch_id" IS NULL THEN false ELSE COALESCE(b."active", false) END AS branch_active
    FROM "clinic_members" cm
    LEFT JOIN "branches" b ON b."id" = cm."branch_id"
    WHERE cm."userId" = ${userId} AND cm."clinicId" = ${clinicId}
    LIMIT 1
  `;
  const legacyBranchId = membership[0]?.branch_active ? membership[0].branch_id : null;
  // assignedBranchId is only a selected-branch hint. It is trusted when it is
  // part of the freshly verified allow-list or the active exact-clinic fallback;
  // a stale JWT claim cannot reintroduce a branch removed by archive/revocation.
  const verifiedAssignedBranchId = assignedBranchId
    && (authorizedBranchIds.includes(assignedBranchId) || assignedBranchId === legacyBranchId)
    ? assignedBranchId
    : null;
  let allowed = Array.from(new Set(
    [...authorizedBranchIds, verifiedAssignedBranchId, legacyBranchId]
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ));

  // OWNER/ADMIN can see every active clinic branch only after a clinic-scoped
  // membership or an already-authenticated canonical allow-list proves access.
  if (ORGANIZATION_ROLES.has(role) && (membership[0] || allowed.length > 0)) {
    const activeBranches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "branches"
      WHERE "clinic_id" = ${clinicId} AND "active" = true
      ORDER BY "isDefault" DESC, "created_at" ASC
    `;
    allowed = Array.from(new Set([...allowed, ...activeBranches.map((branch) => branch.id)]));
  }

  const activeBranchId = assignedBranchId && allowed.includes(assignedBranchId)
    ? assignedBranchId
    : ORGANIZATION_ROLES.has(role)
      ? (legacyBranchId && allowed.includes(legacyBranchId) ? legacyBranchId : allowed[0] ?? null)
      : allowed.length === 1
        ? allowed[0]
        : null;

  if (ORGANIZATION_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'organization', branchIds: allowed } };
  }

  if (BRANCH_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'branch', branchIds: allowed } };
  }

  if (ASSIGNED_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'assigned', branchIds: allowed } };
  }

  return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'assigned', branchIds: [] } };
}

export function canAccessPatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return context.scope.kind === 'organization' && context.branchId === null;
  return context.scope.branchIds.includes(branchId);
}

export function canManagePatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return false;
  return context.scope.kind === 'organization' && (context.allowedBranchIds ?? context.scope.branchIds).includes(branchId);
}

export async function getPatientBranchId(patientId: string, clinicId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT branch_id
    FROM patients
    WHERE id = ${patientId} AND "clinicId" = ${clinicId}
    LIMIT 1
  `;
  return rows[0]?.branch_id ?? null;
}

export async function getPatientIdsForBranchScope(clinicId: string, branchIds: readonly string[]): Promise<string[]> {
  if (!branchIds.length) return [];
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM patients
    WHERE "clinicId" = ${clinicId}
      AND branch_id = ANY(${branchIds}::text[])
      AND "deletedAt" IS NULL
  `;
  return rows.map((row) => row.id);
}

export async function assertPatientBranchBelongsToClinic(
  branchId: string,
  clinicId: string,
  organizationId: string,
): Promise<boolean> {
  if (!branchId || !clinicId || !organizationId) return false;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM branches
    WHERE id = ${branchId}
      AND active = true
      AND (
        organization_id = ${organizationId}
        OR (organization_id IS NULL AND clinic_id = ${clinicId})
        OR (
          organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM "organizations" o
            WHERE o."id" = branches."organization_id"
              AND o."type" = 'CLINIC'
              AND o."originalId" = ${clinicId}
              AND o."archivedAt" IS NULL
          )
        )
      )
    LIMIT 1
  `;
  return rows.length > 0;
}

type PatientBranchWriteClient = Pick<Prisma.TransactionClient, '$executeRaw'>;

export async function setPatientBranch(
  patientId: string,
  clinicId: string,
  branchId: string,
  client: PatientBranchWriteClient = prisma,
): Promise<void> {
  await client.$executeRaw`
    UPDATE patients
    SET branch_id = ${branchId}, "updatedAt" = NOW()
    WHERE id = ${patientId} AND "clinicId" = ${clinicId}
  `;
}
