import prisma from './prisma.js';
import { resolveClinicBranchAccess } from './clinicBranchAccess.js';

export type InventoryBranchContext = {
  clinicId: string;
  role: string;
  /** Verified selected branch; null only for an unfiltered organization view. */
  branchId: string | null;
  organizationWide: boolean;
  /** Branches permitted in the current selection, never copied from JWT branchIds. */
  branchIds: string[];
};

export interface InventoryBranchContextOptions {
  organizationId?: string | null;
  requestedBranchId?: string | null;
}

export async function resolveInventoryBranchContext(
  userId: string,
  clinicId: string,
  role: string,
  options: InventoryBranchContextOptions = {},
): Promise<InventoryBranchContext | null> {
  const access = await resolveClinicBranchAccess({
    userId,
    clinicId,
    organizationId: options.organizationId,
    role,
    requestedBranchId: options.requestedBranchId,
  });

  if (!access) return null;

  const branchIds = access.branchId
    ? [access.branchId]
    : access.allowedBranchIds;

  return {
    clinicId,
    role,
    branchId: access.branchId,
    organizationWide: access.roleScope === 'ORGANIZATION' && access.branchId === null,
    branchIds,
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
