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
  /** Explicit or uniquely resolved branch in the active workspace. */
  branchId: string | null;
  /** All currently authorized branches, separate from the active read scope. */
  allowedBranchIds?: string[];
  scope: PatientBranchScope;
}

export interface PatientBranchContextOptions {
  organizationId?: string | null;
  requestedBranchId?: string | null;
}

function emptyPatientScope(): PatientBranchContext['scope'] {
  return { kind: 'assigned', branchIds: [] };
}

export async function resolvePatientBranchContext(
  userId: string,
  clinicId: string,
  role: string,
  options: PatientBranchContextOptions = {},
): Promise<PatientBranchContext> {
  const access = await resolveClinicBranchAccess({
    userId,
    clinicId,
    organizationId: options.organizationId,
    role,
    requestedBranchId: options.requestedBranchId,
  });

  if (!access) {
    return {
      clinicId,
      userId,
      role,
      branchId: null,
      allowedBranchIds: [],
      scope: emptyPatientScope(),
    };
  }

  const kind = access.roleScope === 'ORGANIZATION'
    ? 'organization'
    : access.roleScope === 'BRANCH'
      ? 'branch'
      : 'assigned';
  const visibleBranchIds = access.branchId
    ? [access.branchId]
    : access.allowedBranchIds;

  return {
    clinicId,
    userId,
    role,
    branchId: access.branchId,
    allowedBranchIds: access.allowedBranchIds,
    scope: { kind, branchIds: visibleBranchIds },
  };
}

/** Branchless legacy rows remain visible only in an unfiltered organization view. */
export function canAccessPatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return context.scope.kind === 'organization' && context.branchId === null;
  return context.scope.branchIds.includes(branchId);
}

export function canManagePatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return false;
  return context.scope.kind === 'organization'
    && (context.allowedBranchIds ?? context.scope.branchIds).includes(branchId);
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

export async function assertPatientBranchBelongsToClinic(branchId: string, clinicId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM branches
    WHERE id = ${branchId}
      AND clinic_id = ${clinicId}
      AND active = true
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
