// ─────────────────────────────────────────────────────────────────────────────
// Patient assignment — who on staff is responsible for a given patient.
//
// Read by exactly one place: the AI kernel's patient-scope check
// (`modules/ai/os/kernel.ts` step 5, gated on `env.AI_PATIENT_SCOPE`). Human
// REST/UI access to patients is deliberately unaffected — that was an explicit
// product decision, not an oversight.
//
// Until this file existed the table had no writer other than the one-off
// backfill in `runOnceMigration('patient_assignment')`. That made the flag
// impossible to turn on safely: every patient seen *after* the backfill would
// have no row, and their own doctor would be told "этот пациент не в вашей
// зоне ответственности". Assignments now accrue as appointments are booked.
// ─────────────────────────────────────────────────────────────────────────────
import prisma from './prisma.js';

/** Mirrors the `role` doc-comment on `model PatientAssignment`. */
export const ASSIGNMENT_ROLES = ['treating_doctor', 'assistant', 'coordinator'] as const;
export type PatientAssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export function isAssignmentRole(value: unknown): value is PatientAssignmentRole {
  return typeof value === 'string' && (ASSIGNMENT_ROLES as readonly string[]).includes(value);
}

export interface EnsureAssignmentInput {
  clinicId: string | null | undefined;
  patientId: string | null | undefined;
  /** Staff member the patient is being assigned to. */
  userId: string | null | undefined;
  role?: PatientAssignmentRole;
}

/**
 * Idempotently link a patient to a staff member.
 *
 * Safe to call on every appointment write: the unique key is
 * `[patientId, userId, role]`, so a repeat call updates the existing row
 * instead of creating a second one, and a previously revoked link is
 * reactivated rather than duplicated.
 *
 * Never throws into the caller. Assignments are a scope *hint* for the AI
 * layer; failing to record one must not fail booking an appointment. A caller
 * that needs to know whether the write landed gets the boolean.
 */
export async function ensurePatientAssignment(input: EnsureAssignmentInput): Promise<boolean> {
  const clinicId = input.clinicId;
  const patientId = input.patientId;
  const userId = input.userId;
  const role: PatientAssignmentRole = input.role || 'treating_doctor';

  // An appointment without a doctor is legal in this schema; there is simply
  // nobody to assign, which is not an error.
  if (!clinicId || !patientId || !userId) return false;

  try {
    await prisma.patientAssignment.upsert({
      where: { patientId_userId_role: { patientId, userId, role } },
      // Re-activating is the whole point of touching an existing row: a doctor
      // taken off a patient and later booked with them again is responsible
      // for them again.
      update: { active: true, clinicId },
      create: { clinicId, patientId, userId, role, active: true },
    });
    return true;
  } catch (error) {
    console.error('[patientAssignment] ensure failed:', error);
    return false;
  }
}

/** Revoke a link without deleting its history. */
export async function revokePatientAssignment(clinicId: string, id: string): Promise<boolean> {
  const result = await prisma.patientAssignment.updateMany({
    where: { id, clinicId, active: true },
    data: { active: false },
  });
  return result.count > 0;
}
