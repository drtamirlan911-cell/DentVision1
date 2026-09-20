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
});
