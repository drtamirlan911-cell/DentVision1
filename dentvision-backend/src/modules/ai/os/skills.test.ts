import { describe, expect, it } from 'vitest';

import { listToolNames } from './tools.js';
import { TOOL_PERMISSIONS, UNGATED_TOOLS } from './toolPermissions.js';
import { SKILLS, skillPermissionSatisfied, skillsFor } from './skills.js';

describe('SKILLS completeness', () => {
  it('never references a tool that does not exist', () => {
    const registered = new Set(listToolNames());
    for (const skill of Object.values(SKILLS)) {
      for (const tool of skill.tools) {
        expect(registered.has(tool), `${skill.id} references unknown tool "${tool}"`).toBe(true);
      }
    }
  });

  it('every tool a skill composes is classified as gated or explicitly ungated', () => {
    for (const skill of Object.values(SKILLS)) {
      for (const tool of skill.tools) {
        const classified = Boolean(TOOL_PERMISSIONS[tool]) || UNGATED_TOOLS.includes(tool);
        expect(classified, `${skill.id}'s tool "${tool}" is neither in TOOL_PERMISSIONS nor UNGATED_TOOLS`).toBe(true);
      }
    }
  });

  it('is not empty and every id key matches its own SkillDefinition.id suffix', () => {
    expect(Object.keys(SKILLS).length).toBeGreaterThan(0);
    for (const [key, skill] of Object.entries(SKILLS)) {
      expect(skill.id.endsWith(`.${key}`)).toBe(true);
    }
  });
});

describe('skillPermissionSatisfied', () => {
  it('an empty requiredPermission is always satisfied', () => {
    expect(skillPermissionSatisfied(new Set(), '')).toBe(true);
    expect(skillPermissionSatisfied(null, '')).toBe(true);
  });

  it('is satisfied when some allowed tool is mapped to exactly that permission', () => {
    expect(skillPermissionSatisfied(new Set(['getPatientCard']), 'medical.read')).toBe(true);
  });

  it('is not satisfied when no allowed tool carries that permission', () => {
    expect(skillPermissionSatisfied(new Set(['getSchedule']), 'appointments.write')).toBe(false);
  });

  it('is never satisfied on a surface with no permission model (allowedTools null)', () => {
    expect(skillPermissionSatisfied(null, 'medical.read')).toBe(false);
  });
});

describe('skillsFor', () => {
  it('returns only skills whose every tool is in both the agent allowedTools and the caller access', () => {
    const skills = skillsFor('agent.clinical.lab', {
      role: 'DOCTOR',
      clinicId: 'clinic-1',
      allowed: new Set(['getLabOrders', 'createLabOrder', 'updateLabOrderStatus', 'createDiagnosticReferral', 'navigate']),
    });
    const ids = skills.map((s) => s.id).sort();
    expect(ids).toEqual(
      [
        'skill.clinical.deadline-monitoring',
        'skill.clinical.create-referral',
        'skill.clinical.lab-order-management',
      ].sort(),
    );
  });

  it('drops a skill when the caller access is missing one of its tools even if the agent allows it', () => {
    const skills = skillsFor('agent.clinical.lab', {
      role: 'DOCTOR',
      clinicId: 'clinic-1',
      allowed: new Set(['getLabOrders']), // createLabOrder/updateLabOrderStatus/createDiagnosticReferral withheld
    });
    expect(skills.map((s) => s.id)).toEqual(['skill.clinical.deadline-monitoring']);
  });

  it('returns nothing for an unknown agent id', () => {
    expect(skillsFor('agent.nope', { role: 'DOCTOR', clinicId: null, allowed: new Set() })).toEqual([]);
  });
});
