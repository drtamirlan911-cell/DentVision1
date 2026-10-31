import { beforeEach, describe, expect, it, vi } from "vitest";

const { clinicMemberFindFirst, appointmentFindFirst, invoiceFindFirst } = vi.hoisted(() => ({
  clinicMemberFindFirst: vi.fn(),
  appointmentFindFirst: vi.fn(),
  invoiceFindFirst: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ default: {
  clinicMember: { findFirst: clinicMemberFindFirst },
  appointment: { findFirst: appointmentFindFirst },
  invoice: { findFirst: invoiceFindFirst },
} }));

import { assertTreatmentPlanDoctorInClinic, assertTreatmentPlanReferencesInClinic, TreatmentPlanReferenceError } from "./treatmentPlanSecurity.js";

beforeEach(() => vi.clearAllMocks());

describe("treatment-plan reference security", () => {
  it("accepts a doctor who belongs to the clinic", async () => {
    clinicMemberFindFirst.mockResolvedValue({ userId: "doctor-a", role: "DOCTOR" });
    await expect(assertTreatmentPlanDoctorInClinic("doctor-a", "clinic-a")).resolves.toBeUndefined();
  });
  it("rejects a doctor from another clinic", async () => {
    clinicMemberFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanDoctorInClinic("doctor-b", "clinic-a")).rejects.toMatchObject({ code: "DOCTOR_OUTSIDE_CLINIC" });
    await expect(assertTreatmentPlanDoctorInClinic("doctor-b", "clinic-a")).rejects.toBeInstanceOf(TreatmentPlanReferenceError);
  });
  it("accepts same-patient appointment and invoice references within the clinic", async () => {
    appointmentFindFirst.mockResolvedValue({ id: "appt-a" });
    invoiceFindFirst.mockResolvedValue({ id: "inv-a" });
    await expect(assertTreatmentPlanReferencesInClinic("clinic-a", { patientId: "patient-a", appointmentId: "appt-a", invoiceId: "inv-a" })).resolves.toBeUndefined();
    expect(appointmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "appt-a", clinicId: "clinic-a", patientId: "patient-a" } }));
    expect(invoiceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv-a", clinicId: "clinic-a", OR: [{ patientId: "patient-a" }, { patientId: null }] } }));
  });
  it("rejects cross-clinic appointment reference", async () => {
    appointmentFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic("clinic-a", { patientId: "patient-a", appointmentId: "appt-b" })).rejects.toMatchObject({ code: "APPOINTMENT_OUTSIDE_CLINIC" });
    expect(invoiceFindFirst).not.toHaveBeenCalled();
  });
  it("rejects cross-clinic invoice reference", async () => {
    invoiceFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic("clinic-a", { patientId: "patient-a", invoiceId: "inv-b" })).rejects.toMatchObject({ code: "INVOICE_OUTSIDE_CLINIC" });
  });
  it("rejects a same-clinic appointment belonging to another patient", async () => {
    appointmentFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic("clinic-a", { patientId: "patient-a", appointmentId: "appt-other-patient" })).rejects.toMatchObject({ code: "APPOINTMENT_OUTSIDE_CLINIC" });
  });
  it("rejects an invoice belonging to another patient even in the same clinic", async () => {
    invoiceFindFirst.mockResolvedValue(null);
    await expect(assertTreatmentPlanReferencesInClinic("clinic-a", { patientId: "patient-a", invoiceId: "inv-other-patient" })).rejects.toMatchObject({ code: "INVOICE_OUTSIDE_CLINIC" });
  });
});
