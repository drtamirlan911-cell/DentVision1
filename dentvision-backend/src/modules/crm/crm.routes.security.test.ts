import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CRM treatment-plan route security contracts', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/crm/crm.routes.ts'), 'utf8');

  it('requires full chart authorization for plan versions and medical write for stage updates', () => {
    expect(source).toContain("crmRouter.get('/treatment-plans/:id/releases', requireClinicalChartRead");
    expect(source).toContain("crmRouter.patch('/treatment-plans/:id/stages/:stageId', requirePermission('patient.write', 'medical.read', 'medical.write')");
  });

  it('validates doctor and linked appointment/invoice references against the patient clinic', () => {
    expect(source).toContain('await assertTreatmentPlanDoctorInClinic(doctorId, patient.clinicId)');
    expect(source).toContain("await assertTreatmentPlanReferencesInClinic(plan.patient?.clinicId || '', { patientId: plan.patientId, appointmentId, invoiceId })");
    expect(source).toContain('TreatmentPlanReferenceError');
  });
});
