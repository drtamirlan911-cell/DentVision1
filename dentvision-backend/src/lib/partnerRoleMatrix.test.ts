import { describe, expect, it } from 'vitest';
import { PARTNER_ROLE_DEFINITIONS, type PartnerRoleFamily } from './roleAccessRegistry.js';

const expected: Record<PartnerRoleFamily, string[]> = {
  DIAGNOSTIC_CENTER: ['DIAGNOSTIC_OWNER','DIAGNOSTIC_ADMIN','DIAGNOSTIC_MANAGER','DIAGNOSTIC_OPERATOR','RADIOLOGIST','RADIOLOGY_TECHNICIAN','DIAGNOSTIC_RECEPTION','DIAGNOSTIC_FINANCE','DIAGNOSTIC_QUALITY'],
  MEDICAL_LAB: ['MEDICAL_LAB_OWNER','MEDICAL_LAB_ADMIN','MEDICAL_LAB_MANAGER','MEDICAL_LAB_RECEPTION','MEDICAL_LAB_TECHNICIAN','MEDICAL_LAB_VALIDATOR','MEDICAL_LAB_DOCTOR','MEDICAL_LAB_FINANCE','MEDICAL_LAB_QUALITY'],
  DENTAL_LAB: ['DENTAL_LAB_OWNER','DENTAL_LAB_ADMIN','DENTAL_LAB_MANAGER','LAB_COORDINATOR','DENTAL_TECHNICIAN','CAD_DESIGNER','CERAMIST','ORTHODONTIC_TECHNICIAN','QC_SPECIALIST','LAB_FINANCE'],
};

describe('specialized partner role matrix', () => {
  it('contains exactly the release role set', () => {
    for (const [family, roles] of Object.entries(expected) as [PartnerRoleFamily, string[]][]) {
      const actual = PARTNER_ROLE_DEFINITIONS.filter((definition) => definition.family === family).map((definition) => definition.key);
      expect(actual.sort()).toEqual([...roles].sort());
    }
  });
  it('keeps owner and finance separation deterministic', () => {
    for (const family of Object.keys(expected) as PartnerRoleFamily[]) {
      for (const role of PARTNER_ROLE_DEFINITIONS.filter((definition) => definition.family === family)) {
        if (role.key.includes('OWNER')) {
          expect(role.defaultScope).toBe('ORGANIZATION');
          expect(role.permissions).toContain('staff.manage');
          expect(role.permissions).toContain('billing.manage');
        }
        if (role.key.includes('FINANCE')) {
          expect(role.permissions).toContain('billing.manage');
          expect(role.permissions).not.toContain('medical.read');
          expect(role.permissions).not.toContain('files.write');
        }
      }
    }
  });
});
