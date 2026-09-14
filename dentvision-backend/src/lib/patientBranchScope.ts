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
): Promise<PatientBranchContext> {
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT branch_id
    FROM clinic_members
    WHERE "userId" = ${userId} AND "clinicId" = ${clinicId}
    LIMIT 1
  `;
  const memberBranchId = membership[0]?.branch_id ?? null;

  if (ORGANIZATION_ROLES.has(role)) {
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM branches
      WHERE clinic_id = ${clinicId} AND active = true
      ORDER BY "isDefault" DESC, "createdAt" ASC
    `;
    return { clinicId, userId, role, branchId: memberBranchId, scope: { kind: 'organization', branchIds: branches.map((b) => b.id) } };
  }

  if (BRANCH_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: memberBranchId, scope: { kind: 'branch', branchIds: memberBranchId ? [memberBranchId] : [] } };
  }

  if (ASSIGNED_ROLES.has(role)) {
    return { clinicId, userId, role, branchId: memberBranchId, scope: { kind: 'assigned', branchIds: memberBranchId ? [memberBranchId] : [] } };
  }

  return { clinicId, userId, role, branchId: memberBranchId, scope: { kind: 'assigned', branchIds: [] } };
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

export async function setPatientBranch(patientId: string, clinicId: string, branchId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE patients
    SET branch_id = ${branchId}, "updatedAt" = NOW()
    WHERE id = ${patientId} AND "clinicId" = ${clinicId}
  `;
}
