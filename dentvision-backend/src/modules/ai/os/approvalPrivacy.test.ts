import { describe, expect, it } from 'vitest';
import {
  decryptAiApprovalDecisionNote,
  decryptAiApprovalParams,
  encryptAiApprovalDecisionNote,
  encryptAiApprovalParams,
  getAiApprovalSummary,
  redactAiApprovalParams,
} from './approvalPrivacy.js';

describe('AI approval PHI storage and disclosure boundary', () => {
  it('encrypts approval params at rest and restores them for an authorized action', () => {
    const params = { patientId: 'patient-phi-99', title: 'Clinical plan', notes: 'Sensitive treatment detail' };
    const stored = encryptAiApprovalParams(params);
    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain('patient-phi-99');
    expect(stored).not.toContain('Sensitive treatment detail');
    expect(decryptAiApprovalParams(stored)).toEqual(params);
  });

  it('keeps legacy JSON-object approvals readable during migration', () => {
    expect(decryptAiApprovalParams({ patientId: 'legacy-patient', amount: 12000 })).toEqual({
      patientId: 'legacy-patient', amount: 12000,
    });
  });

  it('fails closed for malformed encrypted payloads and unsupported legacy strings', () => {
    expect(() => decryptAiApprovalParams('ENC:not-a-valid-ciphertext')).toThrow();
    expect(() => decryptAiApprovalParams('{"patientId":"plain-string"}')).toThrow();
  });

  it('redacts clinical and appointment-linked arguments without medical.read', () => {
    expect(redactAiApprovalParams('createTreatmentPlan', { patientId: 'p1', title: 'Implant plan' }, false)).toEqual({});
    expect(redactAiApprovalParams('cancelAppointment', { appointmentId: 'a1', reason: 'Clinical note' }, false)).toEqual({});
  });

  it('shows only the billing amount without a patient identifier or free text', () => {
    expect(redactAiApprovalParams('createInvoice', {
      patientId: 'p1', amount: 145000, description: 'Patient-specific procedure',
    }, false)).toEqual({ amount: 145000 });
  });

  it('retains only operational bounds for the recall proposal', () => {
    expect(redactAiApprovalParams('getRecallList', {
      inactiveDays: 90, limit: 20, patientId: 'must-not-leak',
    }, false)).toEqual({ inactiveDays: 90, limit: 20 });
  });

  it('restores the complete payload only for callers with medical.read', () => {
    const params = { patientId: 'p1', title: 'Sensitive plan' };
    expect(redactAiApprovalParams('createTreatmentPlan', params, true)).toEqual(params);
  });

  it('uses non-interpolated summaries', () => {
    expect(getAiApprovalSummary('createInvoice')).toBe('Требуется подтверждение: выставление счёта');
    expect(getAiApprovalSummary('createTreatmentPlan')).not.toContain('patient');
    expect(getAiApprovalSummary('cancelAppointment')).not.toContain('reason');
  });

  it('encrypts decision notes and reads legacy plaintext notes', () => {
    const note = 'Sensitive clinical approval note';
    const stored = encryptAiApprovalDecisionNote(note);
    expect(stored).toMatch(/^ENC:/);
    expect(stored).not.toContain(note);
    expect(decryptAiApprovalDecisionNote(stored)).toBe(note);
    expect(decryptAiApprovalDecisionNote('legacy note')).toBe('legacy note');
  });
});
