import prisma from './prisma.js';

export type TreatmentCaseContext = {
  clinicId: string;
  patientId?: string | null;
  treatmentCaseId?: string | null;
};

type CaseLinkedTable = 'appointments' | 'lab_orders' | 'invoices' | 'treatment_plans' | 'referrals' | 'visits';

/**
 * Resolve the canonical clinical case for a write.
 *
 * Explicit caseId is authoritative and is always checked against clinic and
 * patient. Without one, inheritance is automatic only when the patient has
 * exactly one active/on-hold case; concurrent cases are never guessed.
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
      WHERE "id" = ${requested} AND "clinicId" = ${clinicId} AND "deletedAt" IS NULL
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

  return rows.length === 1 ? rows[0].id : null;
}

export async function attachTreatmentCase(table: CaseLinkedTable, recordId: string, treatmentCaseId: string | null): Promise<void> {
  switch (table) {
    case 'appointments':
      await prisma.$executeRaw`UPDATE "appointments" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
    case 'lab_orders':
      await prisma.$executeRaw`UPDATE "lab_orders" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
    case 'invoices':
      await prisma.$executeRaw`UPDATE "invoices" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
    case 'treatment_plans':
      await prisma.$executeRaw`UPDATE "treatment_plans" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
    case 'referrals':
      await prisma.$executeRaw`UPDATE "referrals" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
    case 'visits':
      await prisma.$executeRaw`UPDATE "visits" SET "treatmentCaseId" = ${treatmentCaseId} WHERE "id" = ${recordId}`;
      return;
  }
}

export async function inheritTreatmentCaseForRecord(
  table: CaseLinkedTable,
  recordId: string,
  context: TreatmentCaseContext,
): Promise<string | null> {
  const treatmentCaseId = await resolveTreatmentCaseId(context);
  await attachTreatmentCase(table, recordId, treatmentCaseId);
  return treatmentCaseId;
}
