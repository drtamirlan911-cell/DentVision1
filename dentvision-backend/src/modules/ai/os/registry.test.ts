import { describe, expect, it } from 'vitest';
import { agentsForRole, listAgents, toolsForRole } from './registry.js';
import { listToolNames } from './tools.js';

describe('AI OS agent registry', () => {
  it('registers the core clinical specialty agents', () => {
    const ids = new Set(listAgents().map((agent) => agent.id));
    for (const id of [
      'agent.clinical.dental',
      'agent.clinical.radiology',
      'agent.clinical.endodontic',
      'agent.clinical.orthopedic',
      'agent.clinical.orthodontic',
    ]) expect(ids.has(id)).toBe(true);
  });

  it('does not expose specialty agents outside their declared roles', () => {
    expect(agentsForRole('ASSISTANT').some((a) => a.id === 'agent.clinical.radiology')).toBe(false);
    expect(agentsForRole('ASSISTANT').some((a) => a.id === 'agent.clinical.endodontic')).toBe(false);
    expect(agentsForRole('DOCTOR').some((a) => a.id === 'agent.clinical.radiology')).toBe(true);
    expect(agentsForRole('DOCTOR').some((a) => a.id === 'agent.clinical.orthodontic')).toBe(true);
  });

  it('keeps registry-derived tools constrained to permitted agents', () => {
    const assistantTools = toolsForRole('ASSISTANT');
    const doctorTools = toolsForRole('DOCTOR');
    expect(assistantTools.has('analyzeRadiograph')).toBe(false);
    expect(doctorTools.has('analyzeRadiograph')).toBe(true);
    expect(doctorTools.has('createTreatmentPlan')).toBe(true);
  });
  it('keeps every agent tool reference backed by a registered executor', () => {
    const registered = new Set(listToolNames());
    const missing = listAgents().flatMap((agent) =>
      agent.allowedTools.filter((toolName) => !registered.has(toolName)).map((toolName) => agent.id + ':' + toolName),
    );
    expect(missing).toEqual([]);
  });

  it('exposes employer vacancy overview only to employer roles', () => {
    for (const role of ['EMPLOYER_OWNER', 'EMPLOYER_RECRUITER', 'EMPLOYER_VIEWER']) {
      expect(agentsForRole(role).some((agent) => agent.id === 'agent.jobs.employer')).toBe(true);
      expect(toolsForRole(role).has('getEmployerVacancyOverview')).toBe(true);
    }
    expect(toolsForRole('DOCTOR').has('getEmployerVacancyOverview')).toBe(false);
    expect(toolsForRole('SUPPLIER').has('getEmployerVacancyOverview')).toBe(false);
  });

  it('exposes student learning progress only to the student role', () => {
    expect(agentsForRole('STUDENT').some((agent) => agent.id === 'agent.education.student')).toBe(true);
    expect(toolsForRole('STUDENT').has('getStudentLearningProgress')).toBe(true);
    expect(toolsForRole('LECTURER').has('getStudentLearningProgress')).toBe(false);
    expect(toolsForRole('DOCTOR').has('getStudentLearningProgress')).toBe(false);
  });

  it('exposes lecturer-owned course overview only to lecturer role', () => {
    expect(toolsForRole('LECTURER').has('getLecturerCoursesOverview')).toBe(true);
    expect(toolsForRole('STUDENT').has('getLecturerCoursesOverview')).toBe(false);
    expect(toolsForRole('DOCTOR').has('getLecturerCoursesOverview')).toBe(false);
  });

  it('exposes the diagnostic-center queue only to diagnostic-center roles', () => {
    expect(toolsForRole('DIAGNOSTIC_OWNER').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('DIAGNOSTIC_ADMIN').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('DIAGNOSTIC_QUALITY').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('DIAGNOSTIC_MANAGER').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_OPERATOR').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_RECEPTION').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('RADIOLOGIST').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_FINANCE').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('MEDICAL_LAB_OWNER').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DENTAL_LAB_OWNER').has('getDiagnosticCenterWorkQueue')).toBe(false);
  });

  it('exposes the medical-lab queue only to organization-scope roles', () => {
    for (const role of ['MEDICAL_LAB_OWNER', 'MEDICAL_LAB_ADMIN', 'MEDICAL_LAB_QUALITY']) {
      expect(agentsForRole(role).some((agent) => agent.id === 'agent.partner.medical-lab')).toBe(true);
      expect(toolsForRole(role).has('getMedicalLabReferralQueue')).toBe(true);
    }
    for (const role of [
      'MEDICAL_LAB_MANAGER', 'MEDICAL_LAB_RECEPTION', 'MEDICAL_LAB_TECHNICIAN',
      'MEDICAL_LAB_VALIDATOR', 'MEDICAL_LAB_DOCTOR', 'MEDICAL_LAB_FINANCE', 'DENTAL_LAB_OWNER',
    ]) expect(toolsForRole(role).has('getMedicalLabReferralQueue')).toBe(false);
  });

  it('exposes supplier inventory only in the supplier workspace', () => {
    expect(toolsForRole('SUPPLIER').has('getSupplierInventoryOverview')).toBe(true);
    expect(toolsForRole('SELLER').has('getSupplierInventoryOverview')).toBe(true);
    expect(toolsForRole('BUYER').has('getSupplierInventoryOverview')).toBe(false);
    expect(toolsForRole('DOCTOR').has('getSupplierInventoryOverview')).toBe(false);
  });

  it('exposes the dental-lab queue only to dental-lab roles', () => {
    const ownerTools = toolsForRole('DENTAL_LAB_OWNER');
    const adminTools = toolsForRole('DENTAL_LAB_ADMIN');
    const managerTools = toolsForRole('DENTAL_LAB_MANAGER');
    const technicianTools = toolsForRole('DENTAL_TECHNICIAN');

    expect(ownerTools.has('getDentalLabWorkQueue')).toBe(true);
    expect(adminTools.has('getDentalLabWorkQueue')).toBe(true);
    expect(managerTools.has('getDentalLabWorkQueue')).toBe(false);
    expect(technicianTools.has('getDentalLabWorkQueue')).toBe(true);
    expect(toolsForRole('CAD_DESIGNER').has('getDentalLabWorkQueue')).toBe(true);
    expect(toolsForRole('CERAMIST').has('getDentalLabWorkQueue')).toBe(true);
    expect(toolsForRole('ORTHODONTIC_TECHNICIAN').has('getDentalLabWorkQueue')).toBe(true);
    expect(toolsForRole('MEDICAL_LAB_TECHNICIAN').has('getDentalLabWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_OPERATOR').has('getDentalLabWorkQueue')).toBe(false);
    expect(toolsForRole('SUPPLIER').has('getDentalLabWorkQueue')).toBe(false);
  });

});
