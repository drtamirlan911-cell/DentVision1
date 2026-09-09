import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clinicMemberFindFirst,
  appointmentFindFirst,
  invoiceFindFirst,
} = vi.hoisted(() => ({
  clinicMemberFindFirst: vi.fn(),
  appointmentFindFirst: vi.fn(),
  invoiceFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: {
  clinicMember: { findFirst: clinicMemberFindFirst },
  appointment: { findFirst: appointmentFindFirst },
  invoice: { findFirst: invoiceFindFirst },
} }));

import { assertTreatmentPlanDoctorInClinic, assertTreatmentPlanReferencesInClinic, TreatmentPlanReferenceError } from './treatmentPlanSecurity.js';

beforeEach(() => vi.clearAllMocks());

describe('treatment-plan reference security', () => {
  it('accepts a doctor who belongs to the clinic', async () => {
    clinicMemberFindFirst.mockResolvedValue({ userId: 'doctor-a', role: 'DOCTOR' });
    await expect(assertTreatmentPlanDoctorInClinic('doctor-a', 'clinic-a')).resolves.toBeUndefined();
  });
  it('rejects a doctor from another clinic', async () => {
    clinicMemberFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanDoctorInClinic('doctor-b', 'clinic-a')).rejects.toMatchObject({ code: 'DOCTOR_OUTSIDE_CLINIC' });
    await expect(assertTreatmentPlanDoctorInClinic('doctor-b', 'clinic-a')).rejects.toBeInstanceOf(TreatmentPlanReferenceError);
  });
  it('accepts same-clinic appointment and invoice references', async () => {
    appointmentFindFirst.mockResolvedValue({ id: 'appt-a' });
    invoiceFindFirst.mockResolvedValue({ id: 'inv-a' });
    await expect(assertTreatmentPlanReferencesInClinic('clinic-a', { appointmentId: 'appt-a', invoiceId: 'inv-a' })).resolves.toBeUndefined();
  });
  it('rejects cross-clinic appointment reference', async () => {
    appointmentFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic('clinic-a', { appointmentId: 'appt-b' })).rejects.toMatchObject({ code: 'APPOINTMENT_OUTSIDE_CLINIC' });
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });
  it('rejects cross-clinic invoice reference', async () => {
    invoiceFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic('clinic-a', { invoiceId: 'inv-b' })).rejects.toMatchObject({ code: 'INVOICE_OUTSIDE_CLINIC' });
  });
});
