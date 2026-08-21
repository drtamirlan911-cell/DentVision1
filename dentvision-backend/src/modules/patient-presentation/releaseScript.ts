/**
 * Build the deterministic script for one release, with the same inputs
 * every time.
 *
 * Shared by the patient's script route, the patient's voice route, and the
 * doctor-side LLM generation route — all three have to start from exactly
 * the same skeleton, or a rewrite reviewed by the doctor could drift from
 * what the patient actually reads.
 */

import prisma from '../../lib/prisma.js';
import { readConciergeSettings } from './conciergeSettings.js';
import { buildScriptSkeleton } from './scriptSkeleton.js';
import type { PresentationLocale } from './beats.js';

export async function buildScriptForRelease(
  release: { id: string; clinicId: string; snapshot: unknown; totalAmount: number; approvedByUserId: string },
  patientId: string,
  locale: PresentationLocale,
) {
  const [patient, clinic, approver] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true } }),
    prisma.clinic.findUnique({ where: { id: release.clinicId }, select: { name: true, settings: true } }),
    prisma.user.findUnique({
      where: { id: release.approvedByUserId },
      select: { firstName: true, lastName: true },
    }),
  ]);

  const concierge = readConciergeSettings(clinic?.settings);

  return buildScriptSkeleton({
    releaseId: release.id,
    snapshot: release.snapshot,
    patientFirstName: patient?.firstName ?? null,
    clinicName: clinic?.name ?? null,
    doctorName: approver ? `${approver.firstName} ${approver.lastName}`.trim() : null,
    personaName: concierge.personaName,
    locale,
    totalAmount: release.totalAmount,
    concierge,
  });
}
