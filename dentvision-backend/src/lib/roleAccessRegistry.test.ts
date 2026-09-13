import { describe, expect, it } from 'vitest';
import {
  PARTNER_ROLE_BY_KEY,
  PARTNER_ROLE_DEFINITIONS,
  PARTNER_ROLE_KEYS,
} from './roleAccessRegistry.js';

describe('partner role access registry', () => {
  it('contains the complete diagnostic, medical-lab and dental-lab role families', () => {
    expect(new Set(PARTNER_ROLE_KEYS).size).toBe(PARTNER_ROLE_KEYS.length);
    expect(PARTNER_ROLE_DEFINITIONS.length).toBe(27);

    expect(PARTNER_ROLE_DEFINITIONS.filter((r) => r.family === 'DIAGNOSTIC_CENTER')).toHaveLength(9);
    expect(PARTNER_ROLE_DEFINITIONS.filter((r) => r.family === 'MEDICAL_LAB')).toHaveLength(9);
    expect(PARTNER_ROLE_DEFINITIONS.filter((r) => r.family === 'DENTAL_LAB')).toHaveLength(9);
  });

  it('keeps privileged owner roles organization-scoped', () => {
    for (const key of ['DIAGNOSTIC_OWNER', 'MEDICAL_LAB_OWNER', 'DENTAL_LAB_OWNER']) {
      const definition = PARTNER_ROLE_BY_KEY[key];
      expect(definition).toBeDefined();
      expect(definition.defaultScope).toBe('ORGANIZATION');
      expect(definition.permissions).toContain('staff.manage');
      expect(definition.permissions).toContain('billing.manage');
    }
  });

  it('keeps operational specialists scoped to a branch or assigned work', () => {
    const specialists = PARTNER_ROLE_DEFINITIONS.filter((r) =>
      [
        'DIAGNOSTIC_OPERATOR', 'RADIOLOGY_TECHNICIAN',
        'MEDICAL_LAB_TECHNICIAN', 'MEDICAL_LAB_VALIDATOR', 'MEDICAL_LAB_DOCTOR',
        'LAB_COORDINATOR', 'DENTAL_TECHNICIAN', 'CAD_DESIGNER', 'CERAMIST',
        'ORTHODONTIC_TECHNICIAN',
      ].includes(r.key),
    );

    expect(specialists.length).toBe(10);
    for (const specialist of specialists) {
      expect(['BRANCH', 'ASSIGNED']).toContain(specialist.defaultScope);
      expect(specialist.permissions).not.toContain('staff.manage');
      expect(specialist.permissions).not.toContain('billing.manage');
    }
  });

  it('keeps finance roles free of medical-data permissions', () => {
    for (const key of ['DIAGNOSTIC_FINANCE', 'MEDICAL_LAB_FINANCE', 'LAB_FINANCE']) {
      const definition = PARTNER_ROLE_BY_KEY[key];
      expect(definition.permissions).toContain('billing.manage');
      expect(definition.permissions).not.toContain('medical.read');
      expect(definition.permissions).not.toContain('files.write');
    }
  });

  it('keeps diagnostic and laboratory role families permission-bounded', () => {
    for (const definition of PARTNER_ROLE_DEFINITIONS) {
      expect(definition.permissions).not.toContain('*');
      if (definition.family === 'DIAGNOSTIC_CENTER') {
        expect(definition.permissions.every((permission) => permission.startsWith('diagnostics.') || permission.startsWith('files.') || permission.startsWith('medical.') || permission.startsWith('staff.') || permission.startsWith('billing.') || permission.startsWith('analytics.') || permission.startsWith('audit.'))).toBe(true);
      }
      if (definition.family === 'MEDICAL_LAB' || definition.family === 'DENTAL_LAB') {
        expect(definition.permissions.every((permission) => permission.startsWith('lab.') || permission.startsWith('files.') || permission.startsWith('medical.') || permission.startsWith('staff.') || permission.startsWith('billing.') || permission.startsWith('analytics.') || permission.startsWith('audit.'))).toBe(true);
      }
    }
  });
});
