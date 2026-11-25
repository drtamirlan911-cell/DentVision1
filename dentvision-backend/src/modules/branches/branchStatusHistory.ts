import type { Prisma } from '@prisma/client';
type BranchHistoryTransaction = Prisma.TransactionClient;

export class BranchStatusHistoryUnavailableError extends Error {
  constructor(message: string, readonly baselineAt: Date) {
    super(message);
    this.name = 'BranchStatusHistoryUnavailableError';
  }
}

export async function ensureOrganizationBranchStatusHistoryBaseline(tx: BranchHistoryTransaction, organizationId: string): Promise<Date> {
  const orgId = String(organizationId || '').trim();
  if (!orgId) throw new Error('BRANCH_HISTORY_ORGANIZATION_REQUIRED');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'branch-status-history:' + orgId}))`;
  const inserted = await tx.$queryRaw<Array<{ initialized_at: Date }>>`
    INSERT INTO "branch_status_history_baselines" ("organization_id", "initialized_at")
    VALUES (${orgId}, CURRENT_TIMESTAMP)
    ON CONFLICT ("organization_id") DO NOTHING
    RETURNING "initialized_at"
  `;
  if (inserted.length > 0) {
    await tx.$executeRaw`
      INSERT INTO "branch_status_events" ("branch_id", "organization_id", "active", "effective_at", "source", "actor_user_id")
      SELECT b."id", b."organization_id", b."active", ${inserted[0].initialized_at}, 'baseline', NULL
      FROM "branches" b WHERE b."organization_id" = ${orgId}
    `;
  }
  const rows = await tx.$queryRaw<Array<{ initialized_at: Date }>>`
    SELECT "initialized_at" FROM "branch_status_history_baselines"
    WHERE "organization_id" = ${orgId} LIMIT 1
  `;
  const baselineAt = rows[0]?.initialized_at;
  if (!(baselineAt instanceof Date) || Number.isNaN(baselineAt.getTime())) throw new Error('BRANCH_HISTORY_BASELINE_NOT_AVAILABLE');
  return baselineAt;
}

export async function recordOrganizationBranchStatusEvent(
  tx: BranchHistoryTransaction,
  input: { branchId: string; organizationId: string | null | undefined; active: boolean; actorUserId?: string | null; source: 'created' | 'activated' | 'archived' },
): Promise<void> {
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId) return;
  await ensureOrganizationBranchStatusHistoryBaseline(tx, organizationId);
  await tx.$executeRaw`
    INSERT INTO "branch_status_events" ("branch_id", "organization_id", "active", "effective_at", "source", "actor_user_id")
    VALUES (${input.branchId}, ${organizationId}, ${input.active}, clock_timestamp(), ${input.source}, ${input.actorUserId || null})
  `;
}

export async function getActiveBranchIdsAt(
  tx: BranchHistoryTransaction, organizationId: string, periodStart: Date, asOf = new Date(),
): Promise<string[]> {
  const baselineAt = await ensureOrganizationBranchStatusHistoryBaseline(tx, organizationId);
  if (periodStart.getTime() < baselineAt.getTime()) {
    throw new BranchStatusHistoryUnavailableError('История статусов филиалов не покрывает начало выбранного периода', baselineAt);
  }
  if (periodStart.getTime() > asOf.getTime()) {
    throw new BranchStatusHistoryUnavailableError('Нельзя выставить счёт до начала расчётного периода', baselineAt);
  }
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT b."id"
    FROM "branches" b
    JOIN LATERAL (
      SELECT e."active" FROM "branch_status_events" e
      WHERE e."branch_id" = b."id" AND e."organization_id" = b."organization_id"
        AND e."effective_at" <= ${periodStart}
      ORDER BY e."effective_at" DESC, e."id" DESC LIMIT 1
    ) period_state ON period_state."active" = true
    WHERE b."organization_id" = ${organizationId}
    ORDER BY b."created_at" ASC, b."id" ASC
  `;
  return rows.map((row) => row.id);
}
