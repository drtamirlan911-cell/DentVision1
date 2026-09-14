import { describe, expect, it } from 'vitest';
import { requiresClinicalMedicalManage } from './rbac.js';

const request = (overrides: Record<string, unknown> = {}) => ({
  method: 'POST',
  path: '/treatment-plan',
  body: {},
  user: { role: 'ADMIN' },
  ...overrides,
}) as any;

describe('clinical medical RBAC boundary', () => {
  it('requires medical.manage for treatment-plan writes', () => {
    expect(requiresClinicalMedicalManage(request(), ['patient.write'])).toBe(true);
  });

  it('requires medical.manage for odontogram writes', () => {
    expect(requiresClinicalMedicalManage(request({ path: '/teeth' }), ['patient.write'])).toBe(true);
    expect(requiresClinicalMedicalManage(request({ path: '/teeth/findings' }), ['medical.write'])).toBe(true);
  });

  it('does not escalate read routes', () => {
    expect(requiresClinicalMedicalManage(request({ method: 'GET', path: '/treatment-plan/patient-1' }), ['patient.read'])).toBe(false);
    expect(requiresClinicalMedicalManage(request({ method: 'GET', path: '/teeth/patient-1' }), ['patient.read'])).toBe(false);
  });

  it('allows administrative visit documentation without clinical fields', () => {
    expect(requiresClinicalMedicalManage(request({ path: '/visits', body: { complaints: 'pain', notes: 'front desk note' } }), ['patient.write'])).toBe(false);
  });

  it('requires medical.manage when visit diagnosis or treatment is supplied', () => {
    expect(requiresClinicalMedicalManage(request({ path: '/visits', body: { diagnosis: 'K02.9' } }), ['patient.write'])).toBe(true);
    expect(requiresClinicalMedicalManage(request({ path: '/visits/visit-1', method: 'PATCH', body: { treatment: 'restoration' } }), ['patient.write'])).toBe(true);
  });

  it('never escalates SUPERADMIN through the boundary helper', () => {
    expect(requiresClinicalMedicalManage(request({ user: { role: 'SUPERADMIN' } }), ['patient.write'])).toBe(false);
  });
});
