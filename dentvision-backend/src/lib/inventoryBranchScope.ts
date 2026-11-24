import prisma from './prisma.js';

export type InventoryBranchContext = {
  clinicId: string;
  role: string;
  branchId: string | null;
  organizationWide: boolean;
  branchIds: string[];
};

const ORGANIZATION_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

export function inventoryBranchWhere(ctx: InventoryBranchContext): { clinicId: string; branchId: { in: string[] } } {
  // Organization-wide is still a finite allow-list of currently active
  // branches. Never convert that role into an unfiltered clinic-wide query.
  return { clinicId: ctx.clinicId, branchId: { in: ctx.branchIds } };
}

/**
 * Build inventory scope only from the authenticated request context.
 * auth.ts revalidates canonical BranchMember + legacy assignments against
 * active branch rows on every request, so a second ClinicMember-only lookup
 * here would incorrectly deny canonical-only clinic members.
 */
export async function resolveInventoryBranchContext(
  _userId: string,
  clinicId: string,
  role: string,
  authorizedBranchIds: readonly string[] = [],
  selectedBranchId?: string | null,
): Promise<InventoryBranchContext> {
  const membership = await prisma.$queryRaw<Array<{
    branch_id: string | null;
    branch_active: boolean;
  }>>`
    SELECT cm."branch_id",
      CASE WHEN cm."branch_id" IS NULL THEN false ELSE COALESCE(b."active", false) END AS branch_active
    FROM "clinic_members" cm
    LEFT JOIN "branches" b ON b."id" = cm."branch_id"
    WHERE cm."userId" = ${_userId} AND cm."clinicId" = ${clinicId}
    LIMIT 1
  `;
  const legacyBranchId = membership[0]?.branch_active ? membership[0].branch_id : null;
  let branchIds = Array.from(new Set(
    [...authorizedBranchIds, legacyBranchId]
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ));
  const organizationWide = ORGANIZATION_ROLES.has(String(role || '').toUpperCase());

  if (organizationWide && (membership[0] || branchIds.length > 0)) {
    const activeBranches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "branches"
      WHERE "clinic_id" = ${clinicId} AND "active" = true
      ORDER BY "isDefault" DESC, "created_at" ASC
    `;
    branchIds = Array.from(new Set([...branchIds, ...activeBranches.map((branch) => branch.id)]));
  }
  const branchId = selectedBranchId && branchIds.includes(selectedBranchId)
    ? selectedBranchId
    : legacyBranchId && branchIds.includes(legacyBranchId)
      ? legacyBranchId
      : branchIds[0] ?? null;

  return { clinicId, role, branchId, organizationWide, branchIds };
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
