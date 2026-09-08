import { describe, expect, it } from 'vitest';
import {
  isMutatingActionType,
  isNavigationActionType,
  requiresExplicitConfirmation,
  withClinicalContext,
} from './aiActionPolicy';

describe('aiActionPolicy', () => {
  it.each(['CreateAppointment', 'createAppointment', 'UpdatePatient', 'DeletePatient', 'ApplyToothFindings'])('requires confirmation for %s', (type) => {
    expect(isMutatingActionType(type)).toBe(true);
    expect(requiresExplicitConfirmation({ type, confidence: 0.99 })).toBe(true);
  });

  it.each(['OpenPatients', 'OpenTreatmentPlans', 'OpenInvoice', 'open_schedule', 'Navigate'])('keeps navigation read-only for %s', (type) => {
    expect(isNavigationActionType(type)).toBe(true);
    expect(isMutatingActionType(type)).toBe(false);
    expect(requiresExplicitConfirmation({ type, confidence: 0.99 })).toBe(false);
  });

  it('fails closed on low confidence', () => {
    expect(requiresExplicitConfirmation({ type: 'SomeReadAction', confidence: 0.85 })).toBe(true);
    expect(requiresExplicitConfirmation({ type: 'SomeReadAction', confidence: 0.86 })).toBe(false);
  });

  it('honors an explicit confirmation requirement', () => {
    expect(requiresExplicitConfirmation({ type: 'SomeReadAction', requiresConfirmation: true })).toBe(true);
  });

  it('injects missing clinical identifiers without overwriting explicit values', () => {
    expect(withClinicalContext(
      { note: 'test', patientId: 'explicit-patient' },
      { patientId: 'context-patient', planId: 'plan-1', visitId: 'visit-1' },
    )).toEqual({
      note: 'test',
      patientId: 'explicit-patient',
      planId: 'plan-1',
      visitId: 'visit-1',
    });
  });
});
