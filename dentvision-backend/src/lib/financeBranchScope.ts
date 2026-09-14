import prisma from './prisma.js';

export type FinanceBranchContext = {
  clinicId: string;
  role: string;
  organizationWide: boolean;
  branchId: string | null;
  branchIds: string[];
};

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

/** Resolve the financial visibility boundary before invoices/expenses are queried. */
export async function resolveFinanceBranchContext(
  userId: string,
  clinicId: string,
  role: string,
): Promise<FinanceBranchContext> {
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null; role: string | null }>>`
    SELECT branch_id, role
    FROM clinic_members
    WHERE user_id = ${userId} AND clinic_id = ${clinicId}
    LIMIT 1
  `;

  // Never grant an organization-wide finance view merely because a caller
  // supplied an organization-scoped role. A real clinic membership is required.
  if (!membership[0]) {
    return { clinicId, role, organizationWide: false, branchId: null, branchIds: [] };
  }

  const branchId = membership[0].branch_id ?? null;

  if (ORGANIZATION_ROLES.has(role)) {
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM branches
      WHERE clinic_id = ${clinicId} AND active = true
      ORDER BY is_default DESC, created_at ASC
    `;
    return {
      clinicId,
      role,
      organizationWide: true,
      branchId,
      branchIds: branches.map((b) => b.id),
    };
  }

  return {
    clinicId,
    role,
    organizationWide: false,
    branchId,
    branchIds: branchId ? [branchId] : [],
  };
}

export function financeBranchFilter(ctx: FinanceBranchContext): { clinicId: string; branchId: { in: string[] } } | { clinicId: string; branchId: null } {
  if (!ctx.branchIds.length) return { clinicId: ctx.clinicId, branchId: null };
  return { clinicId: ctx.clinicId, branchId: { in: ctx.branchIds } };
}

export async function assertFinanceBranch(branchId: string | null | undefined, clinicId: string): Promise<boolean> {
  if (!branchId) return false;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM branches
    WHERE id = ${branchId} AND clinic_id = ${clinicId} AND active = true
    LIMIT 1
  `;
  return rows.length > 0;
}
