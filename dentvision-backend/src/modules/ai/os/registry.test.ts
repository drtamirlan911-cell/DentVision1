import { describe, expect, it } from 'vitest';
import { agentsForRole, listAgents, toolsForRole } from './registry.js';

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
  it('exposes the diagnostic-center queue only to diagnostic-center roles', () => {
    expect(toolsForRole('DIAGNOSTIC_OWNER').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('DIAGNOSTIC_OPERATOR').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('DIAGNOSTIC_RADIOLOGIST').has('getDiagnosticCenterWorkQueue')).toBe(true);
    expect(toolsForRole('MEDICAL_LAB_TECHNICIAN').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_FINANCE').has('getDiagnosticCenterWorkQueue')).toBe(false);
    expect(toolsForRole('DENTAL_LAB_OWNER').has('getDiagnosticCenterWorkQueue')).toBe(false);
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
    expect(managerTools.has('getDentalLabWorkQueue')).toBe(true);
    expect(technicianTools.has('getDentalLabWorkQueue')).toBe(true);
    expect(toolsForRole('MEDICAL_LAB_TECHNICIAN').has('getDentalLabWorkQueue')).toBe(false);
    expect(toolsForRole('DIAGNOSTIC_OPERATOR').has('getDentalLabWorkQueue')).toBe(false);
    expect(toolsForRole('SUPPLIER').has('getDentalLabWorkQueue')).toBe(false);
  });

});
