import { describe, expect, it } from 'vitest';
import { isMutatingAIAction, requiresExplicitAIConfirmation, isReadOnlyAIAction } from './aiActionPolicy';

describe('aiActionPolicy', () => {
  it('marks canonical mutating AI tools as mutations', () => {
    expect(isMutatingAIAction('createAppointment')).toBe(true);
    expect(isMutatingAIAction('createInvoice')).toBe(true);
    expect(isMutatingAIAction('createTreatmentPlan')).toBe(true);
    expect(isMutatingAIAction('createDiagnosticReferral')).toBe(true);
    expect(isMutatingAIAction('applyToothFindings')).toBe(true);
  });

  it('catches future mutation names by their write verb', () => {
    expect(isMutatingAIAction('archivePatient')).toBe(true);
    expect(isMutatingAIAction('sendRecall')).toBe(true);
    expect(isMutatingAIAction('refundPayment')).toBe(true);
  });

  it('does not classify navigation or read actions as mutations', () => {
    expect(isMutatingAIAction('OpenTreatmentPlans')).toBe(false);
    expect(isMutatingAIAction('SearchPatients')).toBe(false);
    expect(isReadOnlyAIAction({ type: 'SearchPatients' })).toBe(true);
  });

  it('requires explicit confirmation for mutations even without a server flag', () => {
    expect(requiresExplicitAIConfirmation({ type: 'createInvoice' })).toBe(true);
    expect(requiresExplicitAIConfirmation({ type: 'OpenCashier' })).toBe(false);
    expect(requiresExplicitAIConfirmation({ type: 'SearchPatients', requiresConfirmation: true })).toBe(true);
  });
});
