import prisma from '../../lib/prisma.js';

/**
 * Treatment plans store some references in JSON, so every referenced entity
 * must be proven to belong to the same clinic before it is accepted.
 */
export async function assertTreatmentPlanDoctorInClinic(
  doctorId: string | null | undefined,
  clinicId: string,
): Promise<void> {
  if (!doctorId) return;

  const member = await (prisma as any).clinicMember.findFirst({
    where: { clinicId, userId: doctorId },
    select: { userId: true, role: true },
  });

  if (!member) throw new TreatmentPlanReferenceError('DOCTOR_OUTSIDE_CLINIC');
}

export async function assertTreatmentPlanReferencesInClinic(
  clinicId: string,
  refs: { appointmentId?: string | null; invoiceId?: string | null },
): Promise<void> {
  if (refs.appointmentId) {
    const appointment = await (prisma as any).appointment.findFirst({
      where: { id: refs.appointmentId, clinicId }, select: { id: true },
    });
    if (!appointment) throw new TreatmentPlanReferenceError('APPOINTMENT_OUTSIDE_CLINIC');
  }
  if (refs.invoiceId) {
    const invoice = await (prisma as any).invoice.findFirst({
      where: { id: refs.invoiceId, clinicId }, select: { id: true },
    });
    if (!invoice) throw new TreatmentPlanReferenceError('INVOICE_OUTSIDE_CLINIC');
  }
}

export class TreatmentPlanReferenceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'TreatmentPlanReferenceError';
  }
}
