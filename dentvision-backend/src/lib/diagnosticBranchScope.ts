import prisma from './prisma.js';

export type DiagnosticBranchContext = {
  clinicId: string;
  branchId: string | null;
  branchIds: string[];
  organizationWide: boolean;
};

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

/** Branch boundary for clinic-originated diagnostic referrals. */
export async function resolveDiagnosticBranchContext(
  userId: string,
  clinicId: string,
  role: string,
): Promise<DiagnosticBranchContext> {
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT branch_id
    FROM clinic_members
    WHERE user_id = ${userId} AND clinic_id = ${clinicId}
    LIMIT 1
  `;
  const branchId = membership[0]?.branch_id ?? null;

  if (ORGANIZATION_ROLES.has(role)) {
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM branches
      WHERE clinic_id = ${clinicId} AND active = true
      ORDER BY is_default DESC, created_at ASC
    `;
    return {
      clinicId,
      branchId,
      branchIds: branches.map((b) => b.id),
      organizationWide: true,
    };
  }

  return {
    clinicId,
    branchId,
    branchIds: branchId ? [branchId] : [],
    organizationWide: false,
  };
}

export async function assertDiagnosticBranch(
  branchId: string | null | undefined,
  clinicId: string,
): Promise<boolean> {
  if (!branchId) return false;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM branches
    WHERE id = ${branchId} AND clinic_id = ${clinicId} AND active = true
    LIMIT 1
  `;
  return rows.length > 0;
}

export function diagnosticBranchWhere(ctx: DiagnosticBranchContext): { clinicId: string; branchId: { in: string[] } } | { clinicId: string; branchId: null } {
  if (!ctx.branchIds.length) return { clinicId: ctx.clinicId, branchId: null };
  return { clinicId: ctx.clinicId, branchId: { in: ctx.branchIds } };
}
