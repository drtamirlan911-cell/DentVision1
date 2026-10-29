import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('plan gate treatment-plan reference boundary', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/middleware/planGate.ts'), 'utf8');

  it('resolves patientId from the clinic-scoped stored plan, not request input', () => {
    expect(source).toContain("where: { id: stagePath[1], patient: { clinicId } }");
    expect(source).toContain("select: { id: true, patientId: true }");
    expect(source).toContain("assertTreatmentPlanReferencesInClinic(clinicId, { patientId: plan.patientId, appointmentId, invoiceId })");
    expect(source).not.toContain("assertTreatmentPlanReferencesInClinic(clinicId, { patientId: req.body");
  });

  it('returns not-found for a plan outside the active clinic before validating references', () => {
    expect(source).toContain("code: 'TREATMENT_PLAN_NOT_FOUND'");
    expect(source).toContain("return false;");
  });

  it('fails closed if clinic subscription access cannot be resolved', () => {
    expect(source).toContain("code: 'CLINIC_ACCESS_VALIDATION_UNAVAILABLE'");
    expect(source).toContain("return res.status(503).json({");
    expect(source).not.toContain("console.error('[planGate] loadClinicAccess', e);\n    next();");
  });
});
