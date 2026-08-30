import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clinicFindUnique, patientFindFirst, consentFindUnique } = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  patientFindFirst: vi.fn(),
  consentFindUnique: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: clinicFindUnique },
    patient: { findFirst: patientFindFirst },
    consent: { findUnique: consentFindUnique },
  },
}));

const { IMAGE_CONSENT_TYPE, checkImageAnalysisConsent } = await import('./imageConsent.js');

const CLINIC_ON = { settings: { aiImageAnalysis: true } };
const CLINIC_OFF = { settings: { aiImageAnalysis: false } };

beforeEach(() => {
  clinicFindUnique.mockReset();
  patientFindFirst.mockReset();
  consentFindUnique.mockReset();
});

describe('checkImageAnalysisConsent — the clinic gate', () => {
  it('denies when the clinic has not turned image analysis on', async () => {
    clinicFindUnique.mockResolvedValue(CLINIC_OFF);

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: false,
      reason: 'CLINIC_DISABLED',
    });
    // The patient is never even looked up: the clinic said no.
    expect(patientFindFirst).not.toHaveBeenCalled();
  });

  it('denies when the setting is simply absent, rather than defaulting to on', async () => {
    clinicFindUnique.mockResolvedValue({ settings: {} });

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toMatchObject({
      allowed: false,
      reason: 'CLINIC_DISABLED',
    });
  });

  it.each([
    ['a null settings blob', { settings: null }],
    ['a settings blob that is not an object', { settings: 'broken' }],
  ])('denies on %s instead of guessing', async (_label, clinic) => {
    clinicFindUnique.mockResolvedValue(clinic);

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toMatchObject({ allowed: false });
  });

  it('denies without a clinic id at all', async () => {
    await expect(checkImageAnalysisConsent(null, 'p1')).resolves.toEqual({
      allowed: false,
      reason: 'NO_CLINIC',
    });
    expect(clinicFindUnique).not.toHaveBeenCalled();
  });
});

describe('checkImageAnalysisConsent — the patient gate', () => {
  beforeEach(() => clinicFindUnique.mockResolvedValue(CLINIC_ON));

  it('allows an unregistered patient on the clinic decision alone', async () => {
    patientFindFirst.mockResolvedValue({ userId: null });

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: true,
      patientRegistered: false,
    });
    // Nobody to ask, so nothing is looked up.
    expect(consentFindUnique).not.toHaveBeenCalled();
  });

  it('allows a registered patient who accepted', async () => {
    patientFindFirst.mockResolvedValue({ userId: 'u1' });
    consentFindUnique.mockResolvedValue({ accepted: true, version: '1.0' });

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: true,
      patientRegistered: true,
    });
    expect(consentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_type: { userId: 'u1', type: IMAGE_CONSENT_TYPE } } }),
    );
  });

  it('denies a registered patient who declined', async () => {
    patientFindFirst.mockResolvedValue({ userId: 'u1' });
    consentFindUnique.mockResolvedValue({ accepted: false, version: '1.0' });

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: false,
      reason: 'PATIENT_DECLINED',
    });
  });

  it('denies a registered patient who was never asked', async () => {
    patientFindFirst.mockResolvedValue({ userId: 'u1' });
    consentFindUnique.mockResolvedValue(null);

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: false,
      reason: 'PATIENT_NOT_ASKED',
    });
  });

  it('does not grandfather consent given against older wording', async () => {
    patientFindFirst.mockResolvedValue({ userId: 'u1' });
    consentFindUnique.mockResolvedValue({ accepted: true, version: '0.9' });

    await expect(checkImageAnalysisConsent('c1', 'p1')).resolves.toEqual({
      allowed: false,
      reason: 'PATIENT_NOT_ASKED',
    });
  });

  it('does not resolve a patient belonging to another clinic', async () => {
    patientFindFirst.mockResolvedValue(null);

    await expect(checkImageAnalysisConsent('c1', 'p-other')).resolves.toEqual({
      allowed: false,
      reason: 'NO_PATIENT',
    });
    expect(patientFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-other', clinicId: 'c1' } }),
    );
  });

  it('never returns allowed without both gates having been consulted', async () => {
    // Guards the shape of the function itself: `allowed: true` is only ever
    // reachable after the clinic check, and after the patient check when there
    // is a registered patient.
    clinicFindUnique.mockResolvedValue(CLINIC_ON);
    patientFindFirst.mockResolvedValue({ userId: 'u1' });
    consentFindUnique.mockResolvedValue({ accepted: true, version: '1.0' });

    const result = await checkImageAnalysisConsent('c1', 'p1');

    expect(result.allowed).toBe(true);
    expect(clinicFindUnique).toHaveBeenCalledTimes(1);
    expect(patientFindFirst).toHaveBeenCalledTimes(1);
    expect(consentFindUnique).toHaveBeenCalledTimes(1);
  });
});
