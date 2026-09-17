import prisma from './prisma.js';

/**
 * Resolves the canonical TreatmentCase for a CRM write.
 * A case is never inferred from free-form notes. The caller may provide
 * treatmentCaseId explicitly, or we can resolve one from the patient when
 * exactly one active case exists. Ambiguous patients intentionally remain
 * unlinked so we never attach a clinical/financial record to the wrong case.
 */
export async function resolveTreatmentCaseId(input: {
  treatmentCaseId?: string | null;
  patientId?: string | null;
  clinicId?: string | null;
}) {
  if (input.treatmentCaseId) {
    const row = await prisma.treatmentCase.findFirst({
      where: {
        id: input.treatmentCaseId,
        ...(input.patientId ? { patientId: input.patientId } : {}),
        ...(input.clinicId ? { clinicId: input.clinicId } : {}),
      },
      select: { id: true },
    });
    if (!row) throw new Error('TREATMENT_CASE_NOT_FOUND');
    return row.id;
  }

  if (!input.patientId || !input.clinicId) return null;

  const active = await prisma.treatmentCase.findMany({
    where: {
      patientId: input.patientId,
      clinicId: input.clinicId,
      status: { not: 'completed' },
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 2,
  });

  return active.length === 1 ? active[0].id : null;
}

export function treatmentCaseCreateData(treatmentCaseId: string | null | undefined) {
  return treatmentCaseId ? { treatmentCase: { connect: { id: treatmentCaseId } } } : {};
}