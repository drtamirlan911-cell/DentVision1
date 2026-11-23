import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts'),
  'utf8',
);

describe('patient portal medical-history write contract', () => {
  it('encrypts only structured object history and rejects scalar/array roots', () => {
    expect(source).toContain('isStructuredMedicalHistoryRoot');
    expect(source).toContain('history !== null && !isStructuredMedicalHistoryRoot(history)');
    expect(source).toContain('data.medicalHistory = encryptMedicalHistory(history)');
    expect(source).toContain("Передайте медицинскую историю в исходном формате");
    expect(source).toContain("Медицинская история должна быть объектом");
  });
});


describe('patient portal online booking branch contract', () => {
  it('uses the linked patient branch for available slots and rejects missing/inactive branches', () => {
    expect(source).toContain("where: { id: patientId }");
    expect(source).toContain("select: { clinicId: true, branchId: true }");
    expect(source).toContain("code: 'PATIENT_BRANCH_UNASSIGNED'");
    expect(source).toContain("code: 'PATIENT_BRANCH_INACTIVE'");
    expect(source).toContain('portalSvc.getAvailableSlots(clinicId, date, doctorId, branchId)');
  });

  it('does not accept a branch from the patient request body', () => {
    const start = source.indexOf("patientPortalRouter.post('/appointments/request'");
    const route = source.slice(start);
    expect(route).toContain('portalSvc.requestAppointment({ patientId, clinicId');
    expect(route).not.toContain('branchId: body.branchId');
  });
});
