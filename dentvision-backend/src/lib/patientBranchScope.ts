import type { Prisma } from '@prisma/client';
import prisma from './prisma.js';

export type PatientBranchScope =
  | { kind: 'organization'; branchIds: string[] }
  | { kind: 'branch'; branchIds: string[] }
  | { kind: 'assigned'; branchIds: string[] };

export interface PatientBranchContext {
  clinicId: string;
  userId: string;
  role: string;
  branchId: string | null;
  scope: PatientBranchScope;
}

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN']);
const BRANCH_ROLES = new Set(['MANAGER']);
const ASSIGNED_ROLES = new Set(['DOCTOR', 'ASSISTANT', 'RECEPTIONIST', 'CASHIER']);

export async function resolvePatientBranchContext(
  userId: string,
  clinicId: string,
  role: string,
  authorizedBranchIds: readonly string[] = [],
  assignedBranchId?: string | null,
): Promise<PatientBranchContext> {
  // authenticate has already resolved canonical PersonRole + active
  // BranchMember assignments, with a legacy ClinicMember fallback only for
  // clinics that have not migrated to the canonical organization model.
  const branchIds = Array.from(new Set(
    [...authorizedBranchIds, assignedBranchId]
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ));
  const activeBranchId = assignedBranchId && branchIds.includes(assignedBranchId)
    ? assignedBranchId
    : branchIds[0] ?? null;

  if (ORGANIZATION_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'organization', branchIds } };
  }

  if (BRANCH_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'branch', branchIds } };
  }

  if (ASSIGNED_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'assigned', branchIds } };
  }

  return { clinicId, userId, role, branchId: activeBranchId, scope: { kind: 'assigned', branchIds: [] } };
}

export function canAccessPatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return false;
  return context.scope.branchIds.includes(branchId);
}

export function canManagePatientBranch(context: PatientBranchContext, branchId: string | null): boolean {
  if (!branchId) return false;
  return context.scope.kind === 'organization' && context.scope.branchIds.includes(branchId);
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
