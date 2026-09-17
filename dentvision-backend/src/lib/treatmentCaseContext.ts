import prisma from './prisma.js';

export type TreatmentCaseContext = {
  clinicId: string;
  patientId?: string | null;
  treatmentCaseId?: string | null;
};

/**
 * Resolve the canonical clinical case for a write.
 *
 * Rules:
 * 1. An explicit caseId is authoritative, but must belong to the same clinic
 *    and patient when a patient is supplied.
 * 2. Without an explicit caseId, inherit the only active case for the patient.
 * 3. Never guess when the patient has multiple active cases.
 *
 * The helper intentionally uses SQL for the new nullable case columns while
 * Prisma schema/client generation catches up with the production migration.
 */
export async function resolveTreatmentCaseId(context: TreatmentCaseContext): Promise<string | null> {
  const clinicId = String(context.clinicId || '').trim();
  const patientId = context.patientId ? String(context.patientId).trim() : '';
  const requested = context.treatmentCaseId ? String(context.treatmentCaseId).trim() : '';

  if (!clinicId) throw new Error('Clinic context is required');
  if (requested) {
    const rows = await prisma.$queryRaw<Array<{ id: string; clinicId: string; patientId: string; status: string }>>`
      SELECT "id", "clinicId", "patientId", "status"
      FROM "treatment_cases"
      WHERE "id" = ${requested}
        AND "clinicId" = ${clinicId}
        AND "deletedAt" IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error('Клинический кейс не найден в выбранной клинике');
    if (patientId && row.patientId !== patientId) throw new Error('Клинический кейс не принадлежит выбранному пациенту');
    return row.id;
  }

  if (!patientId) return null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "treatment_cases"
    WHERE "clinicId" = ${clinicId}
      AND "patientId" = ${patientId}
      AND "deletedAt" IS NULL
      AND "status" IN ('active', 'on_hold')
    ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "updatedAt" DESC, "createdAt" DESC
    LIMIT 2
  `;

  // A patient may legitimately have multiple concurrent treatment cases.
  // Automatic inheritance is therefore only safe when there is exactly one.
  return rows.length === 1 ? rows[0].id : null;
}

export async function attachTreatmentCase(
  table: 'appointments' | 'lab_orders' | 'invoices' | 'treatment_plans' | 'referrals' | 'visits',
  recordId: string,
  treatmentCaseId: string | null,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE ${prisma.raw(table)}
    SET "treatmentCaseId" = ${treatmentCaseId}
    WHERE "id" = ${recordId}
  `;
}

export async function inheritTreatmentCaseForRecord(
  table: 'appointments' | 'lab_orders' | 'invoices' | 'treatment_plans' | 'referrals' | 'visits',
  recordId: string,
  context: TreatmentCaseContext,
): Promise<string | null> {
  const treatmentCaseId = await resolveTreatmentCaseId(context);
  await attachTreatmentCase(table, recordId, treatmentCaseId);
  return treatmentCaseId;
}
