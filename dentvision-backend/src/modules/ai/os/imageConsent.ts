/**
 * May this clinic send this patient's images to the model?
 *
 * Two gates, both required, and the second only when there is somebody to ask:
 *
 *  1. **The clinic** turns image analysis on (`Clinic.settings.aiImageAnalysis`).
 *     Off by default — radiographs are medical data leaving the platform, so
 *     it is a decision somebody makes, never something that happens because
 *     nobody looked at a setting.
 *  2. **The patient**, when they have an account in the portal
 *     (`Patient.userId`). A registered patient can answer for themselves, so
 *     they are asked; a walk-in with only a paper chart cannot be, and the
 *     clinic's consent stands alone for them.
 *
 * Fail-closed throughout: anything unknown — no clinic, no patient row, an
 * unreadable settings blob — denies. The cost of a wrong "no" is a doctor
 * doing it by hand; the cost of a wrong "yes" is a patient's radiograph
 * leaving the country without their agreement.
 */

import prisma from '../../../lib/prisma.js';
import { mergeClinicSettings } from '../../clinics/clinicSettings.js';
import { REQUIRED_CONSENTS } from '../../compliance/consent.catalog.js';

export const IMAGE_CONSENT_TYPE = 'ai_image_analysis';

export type ImageConsentDenyReason =
  | 'NO_CLINIC'
  | 'CLINIC_DISABLED'
  | 'NO_PATIENT'
  | 'PATIENT_DECLINED'
  | 'PATIENT_NOT_ASKED';

export type ImageConsentDenied = { allowed: false; reason: ImageConsentDenyReason };

export type ImageConsentResult =
  | { allowed: true; patientRegistered: boolean }
  | ImageConsentDenied;

/**
 * Explicit predicate rather than `if (!result.allowed)`.
 *
 * This package compiles without `strictNullChecks`, and control-flow narrowing
 * of a boolean-discriminated union is unreliable there — callers would end up
 * reaching for `as any` to read `reason`.
 */
export function isImageConsentDenied(result: ImageConsentResult): result is ImageConsentDenied {
  return result.allowed === false;
}

/** Human wording for the UI — a refusal has to say what to do about it. */
export const IMAGE_CONSENT_MESSAGE: Record<ImageConsentDenyReason, string> = {
  NO_CLINIC: 'Не удалось определить клинику',
  CLINIC_DISABLED: 'Клиника не включила анализ снимков ИИ — включается в настройках клиники',
  NO_PATIENT: 'Пациент не найден',
  PATIENT_DECLINED: 'Пациент не дал согласия на анализ снимков ИИ',
  PATIENT_NOT_ASKED: 'Пациент ещё не отвечал на запрос согласия — попросите подтвердить его в личном кабинете',
};

/** Current catalogue version, so a bumped version re-asks instead of grandfathering. */
function requiredVersion(): string {
  return REQUIRED_CONSENTS.find((c) => c.type === IMAGE_CONSENT_TYPE)?.version ?? '1.0';
}

export async function checkImageAnalysisConsent(
  clinicId: string | null | undefined,
  patientId: string,
): Promise<ImageConsentResult> {
  if (!clinicId) return { allowed: false, reason: 'NO_CLINIC' };

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { settings: true },
  });
  if (!clinic) return { allowed: false, reason: 'NO_CLINIC' };
  if (mergeClinicSettings(clinic.settings).aiImageAnalysis !== true) {
    return { allowed: false, reason: 'CLINIC_DISABLED' };
  }

  // Scoped by clinic as well as id: a patient id from another tenant must not
  // resolve here just because the caller's clinic said yes.
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { userId: true },
  });
  if (!patient) return { allowed: false, reason: 'NO_PATIENT' };

  // Not registered in the portal — there is no one to ask, and the clinic's
  // decision is the whole answer.
  if (!patient.userId) return { allowed: true, patientRegistered: false };

  const consent = await prisma.consent.findUnique({
    where: { userId_type: { userId: patient.userId, type: IMAGE_CONSENT_TYPE } },
    select: { accepted: true, version: true },
  });
  if (!consent) return { allowed: false, reason: 'PATIENT_NOT_ASKED' };
  if (!consent.accepted) return { allowed: false, reason: 'PATIENT_DECLINED' };
  // A consent given against an older wording is not consent to the new one.
  if (consent.version !== requiredVersion()) {
    return { allowed: false, reason: 'PATIENT_NOT_ASKED' };
  }

  return { allowed: true, patientRegistered: true };
}
