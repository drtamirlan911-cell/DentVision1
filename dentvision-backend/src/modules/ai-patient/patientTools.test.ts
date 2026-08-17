import { describe, expect, it, vi } from 'vitest';

import {
  FORBIDDEN_PARAM_NAMES,
  PATIENT_TOOLS,
  executePatientTool,
  listPatientToolNames,
} from './patientTools.js';
import { toolsForRole } from '../ai/os/registry.js';

/**
 * These are the tests that matter for this surface. The assistant reads a
 * patient's medical record, so the question is never "does it answer well" but
 * "can it be talked into answering about somebody else".
 */

describe('the patient assistant cannot be pointed at another patient', () => {
  it('declares no parameter that names a patient, user or clinic', () => {
    const offenders: string[] = [];
    for (const [name, tool] of Object.entries(PATIENT_TOOLS)) {
      for (const param of Object.keys(tool.parameters.properties || {})) {
        if (FORBIDDEN_PARAM_NAMES.includes(param.toLowerCase())) {
          offenders.push(`${name}.${param}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ignores whatever arguments the model invents', async () => {
    // The model is free to emit anything. If a tool read an id out of `args`
    // instead of the context, this is the shape that would exploit it.
    const seen: string[] = [];
    const ctx = { userId: 'user-A', patientId: 'patient-A', clinicId: 'clinic-1' };

    for (const name of listPatientToolNames()) {
      const tool = PATIENT_TOOLS[name];
      const spy = vi.spyOn(tool, 'execute').mockImplementation(async (_args, c) => {
        seen.push(c.patientId);
        return null;
      });
      await executePatientTool(
        name,
        { patientId: 'patient-B', userId: 'user-B', iin: '000000000000' },
        ctx,
      );
      spy.mockRestore();
    }

    // Every tool resolved against the session's patient, never the argument.
    expect(seen).toHaveLength(listPatientToolNames().length);
    expect([...new Set(seen)]).toEqual(['patient-A']);
  });

  it('refuses a tool name it does not know', async () => {
    await expect(
      executePatientTool('searchPatients', {}, { userId: 'u', patientId: 'p', clinicId: null }),
    ).rejects.toThrow('UNKNOWN_PATIENT_TOOL:searchPatients');
  });
});

describe('the patient registry is separate from the staff one', () => {
  it('shares no tool name with what the STUDENT role can reach', () => {
    // A portal account carries STUDENT. If a name existed in both registries,
    // a change to the staff matrix could silently widen the patient surface.
    const staffTools = toolsForRole('STUDENT');
    const shared = listPatientToolNames().filter((name) => staffTools.has(name));
    expect(shared).toEqual([]);
  });

  it('exposes only read tools while actions are still gated elsewhere', () => {
    // Phase 3 is read-only on purpose: booking, cancelling and paying arrive
    // with their confirmation flow, not ahead of it.
    const mutating = listPatientToolNames().filter((n) => !/^getMy/.test(n));
    expect(mutating).toEqual([]);
  });
});
