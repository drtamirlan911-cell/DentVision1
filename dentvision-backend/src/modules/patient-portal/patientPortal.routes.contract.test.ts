import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts'),
  'utf8',
);
const serviceSource = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/patient-portal/patientPortal.service.ts'),
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
    expect(source).toContain('portalSvc.isActiveClinicBranch(clinicId, branchId)');
    expect(source).toContain('portalSvc.getAvailableSlots(clinicId, date, doctorId, branchId, patientId)');
  });

  it('does not accept a branch from the patient request body', () => {
    const start = source.indexOf("patientPortalRouter.post('/appointments/request'");
    const route = source.slice(start);
    expect(route).toContain('portalSvc.requestAppointment({ patientId, clinicId');
    expect(route).not.toContain('branchId: body.branchId');
  });
});


describe('patient portal canonical branch ownership', () => {
  it('validates active branches through the canonical organization when clinicId is null', () => {
    expect(serviceSource).toContain("where: { originalType: 'Clinic', originalId: clinicId }");
    expect(serviceSource).toContain('OR: [{ clinicId }, { clinicId: null, organizationId: organization.id }]');
    expect(serviceSource).toContain('if (organization?.archivedAt) return false');
  });

  it('does not allow slot discovery to bypass the linked patient branch', () => {
    expect(source).toContain('portalSvc.getAvailableSlots(clinicId, date, doctorId, branchId, patientId)');
  });
});
