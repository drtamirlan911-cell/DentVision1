import { describe, expect, it } from 'vitest';
import {
  PARTNER_ROLE_BY_KEY,
  PARTNER_ROLE_DEFINITIONS,
  PARTNER_ROLE_KEYS,
} from './roleAccessRegistry.js';

describe('partner role access registry', () => {
  it('contains a unique key for every specialized partner role', () => {
    expect(new Set(PARTNER_ROLE_KEYS).size).toBe(PARTNER_ROLE_KEYS.length);
    expect(PARTNER_ROLE_DEFINITIONS.length).toBeGreaterThanOrEqual(25);
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
    const owners = PARTNER_ROLE_DEFINITIONS.filter((r) => r.key.endsWith('_OWNER'));
    const specialists = PARTNER_ROLE_DEFINITIONS.filter((r) =>
      ['DIAGNOSTIC_OPERATOR', 'RADIOLOGY_TECHNICIAN', 'MEDICAL_LAB_TECHNICIAN', 'DENTAL_TECHNICIAN', 'CAD_DESIGNER', 'CERAMIST'].includes(r.key),
    );

    expect(owners.length).toBe(3);
    expect(specialists.length).toBe(6);
    for (const specialist of specialists) {
      expect(['BRANCH', 'ASSIGNED']).toContain(specialist.defaultScope);
      expect(specialist.permissions).not.toContain('staff.manage');
      expect(specialist.permissions).not.toContain('billing.manage');
    }
  });

  it('never grants cross-organization permissions through the role definition', () => {
    for (const definition of PARTNER_ROLE_DEFINITIONS) {
      expect(definition.permissions).not.toContain('*');
    }
  });
});
