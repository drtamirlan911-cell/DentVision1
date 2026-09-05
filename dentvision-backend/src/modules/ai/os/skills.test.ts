import { describe, expect, it } from 'vitest';

import { listToolNames } from './tools.js';
import { TOOL_PERMISSIONS, UNGATED_TOOLS } from './toolPermissions.js';
import { SKILLS, skillPermissionSatisfied, skillsFor, skillCatalogueFor } from './skills.js';
import { toolsForRole } from './registry.js';
import type { AiToolAccess } from './access.js';

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

/**
 * The catalogue is what the assistant shows a user before they type anything.
 * Until it existed, `skillsFor` was reachable only from this file — the
 * registry was written, permission-filtered and then never asked, so every
 * role opened the same blank input box.
 */
describe('skillCatalogueFor', () => {
  /** Access as `resolveAiToolAccess` builds it for a role with full permissions. */
  const fullAccessFor = (role: string): AiToolAccess => ({
    role,
    clinicId: 'clinic-1',
    allowed: toolsForRole(role),
  });

  it('offers a cashier payment monitoring', () => {
    const titles = skillCatalogueFor(fullAccessFor('CASHIER'), 'staff').map((s) => s.title);
    expect(titles).toContain('Контроль оплат');
  });

  it('withholds payment monitoring when the caller cannot read billing', () => {
    // Same role, but `resolveAiToolAccess` proved no billing tools — exactly
    // what it returns when the permission graph withholds `billing.read`.
    const withoutBilling: AiToolAccess = {
      role: 'CASHIER',
      clinicId: 'clinic-1',
      allowed: new Set([...toolsForRole('CASHIER')].filter((t) => t !== 'getDebtors' && t !== 'getRevenue')),
    };
    const titles = skillCatalogueFor(withoutBilling, 'staff').map((s) => s.title);
    expect(titles).not.toContain('Контроль оплат');
  });

  it('offers a doctor the clinical skills', () => {
    const titles = skillCatalogueFor(fullAccessFor('DOCTOR'), 'staff').map((s) => s.title);
    expect(titles).toContain('Карта пациента');
    expect(titles).toContain('История визитов');
  });

  it('lists each capability once even when several agents reach it', () => {
    // getVisits sits on more than one agent a doctor may use, so a naive
    // concatenation would repeat this skill in the list the user sees.
    const ids = skillCatalogueFor(fullAccessFor('DOCTOR'), 'staff').map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id, title and ready-to-send prompt', () => {
    const entries = skillCatalogueFor(fullAccessFor('OWNER'), 'staff');
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.id).toBeTruthy();
      expect(entry.title.trim()).toBeTruthy();
      expect(entry.prompt.trim()).toBeTruthy();
    }
  });

  /**
   * A guest is not shown an empty list — course search is ungated and browsing
   * Academy is the point of a guest session. What they must never be offered is
   * anything touching a clinic: patient records, money, the schedule.
   */
  it('offers a guest only the ungated course skill, nothing clinical or financial', () => {
    const entries = skillCatalogueFor(fullAccessFor('GUEST'), 'staff');
    expect(entries.map((s) => s.id)).toEqual(['skill.education.learning-recommendation']);
    for (const entry of entries) {
      expect(entry.domain).not.toBe('clinical');
      expect(entry.domain).not.toBe('business');
    }
  });
});

describe('SKILLS example prompts', () => {
  it('every skill carries a prompt that is not just its own title echoed back', () => {
    for (const skill of Object.values(SKILLS)) {
      expect(skill.examplePrompt.trim(), `${skill.id} has no examplePrompt`).toBeTruthy();
      expect(skill.examplePrompt).not.toBe(skill.title);
    }
  });
});
