import prisma from '../../../lib/prisma.js';

/**
 * Resolve a patient only inside the already-authorized clinic boundary.
 * AI actions must not use a bare patient id as an authorization boundary.
 */
export async function resolvePatientForClinic<T extends Record<string, unknown> = Record<string, unknown>>(
  patientId: string,
  clinicId: string,
  select?: Record<string, boolean>,
): Promise<T | null> {
  if (!patientId || !clinicId) return null;

  return prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    ...(select ? { select } : {}),
  }) as Promise<T | null>;
}

/**
 * Resolve an appointment only when it belongs to the requested clinic.
 * This prevents appointment ids from becoming a cross-tenant pivot into
 * patient data or mutable appointment state.
 */
export async function resolveAppointmentForClinic<T extends Record<string, unknown> = Record<string, unknown>>(
  appointmentId: string,
  clinicId: string,
  select?: Record<string, boolean>,
): Promise<T | null> {
  if (!appointmentId || !clinicId) return null;

  return prisma.appointment.findFirst({
    where: { id: appointmentId, clinicId },
    ...(select ? { select } : {}),
  }) as Promise<T | null>;
}
