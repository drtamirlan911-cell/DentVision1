import prisma from './prisma.js';

export type InventoryBranchContext = {
  clinicId: string;
  role: string;
  branchId: string | null;
  organizationWide: boolean;
  branchIds: string[];
};

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

export async function resolveInventoryBranchContext(
  userId: string,
  clinicId: string,
  role: string,
): Promise<InventoryBranchContext> {
  const membership = await prisma.$queryRaw<Array<{ branch_id: string | null }>>`
    SELECT branch_id
    FROM clinic_members
    WHERE "userId" = ${userId} AND "clinicId" = ${clinicId}
    LIMIT 1
  `;
  const branchId = membership[0]?.branch_id ?? null;

  if (ORGANIZATION_ROLES.has(role)) {
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM branches
      WHERE clinic_id = ${clinicId} AND active = true
      ORDER BY "isDefault" DESC, "createdAt" ASC
    `;
    return {
      clinicId,
      role,
      branchId,
      organizationWide: true,
      branchIds: branches.map((b) => b.id),
    };
  }

  return {
    clinicId,
    role,
    branchId,
    organizationWide: false,
    branchIds: branchId ? [branchId] : [],
  };
}

export async function assertInventoryBranch(
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

export async function getInventoryIdsForBranches(
  clinicId: string,
  branchIds: readonly string[],
): Promise<string[]> {
  if (!branchIds.length) return [];
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_items
    WHERE clinic_id = ${clinicId}
      AND branch_id = ANY(${branchIds}::text[])
  `;
  return rows.map((row) => row.id);
}
