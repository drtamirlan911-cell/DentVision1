/**
 * The patient's read of their own presentation.
 *
 * Mounted under `/api/patient-portal`, deliberately not under `/api/ai`: that
 * router carries `guardAiAccess`, the clinic's billing gate, and a patient's
 * access to their own approved plan must not depend on their clinic's tariff.
 * Same reasoning already written down in ai-patient/aiPatient.routes.ts.
 *
 * This module never touches `TreatmentPlan`. It reads a published release and
 * builds the script from that frozen snapshot — a structural test
 * (planReleaseBoundary.test.ts) fails if that stops being true.
 */

import { Router } from 'express';

import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { resolvePatientForUser } from '../patient-portal/patientLink.js';
import { PRESENTATION_LOCALES, type PresentationLocale } from './beats.js';
import { getPublishedRelease, listPublishedReleases } from './planRelease.service.js';
import { buildScriptSkeleton } from './scriptSkeleton.js';

export const patientPresentationRouter = Router();

patientPresentationRouter.use(authenticate);

function resolveLocale(raw: unknown): PresentationLocale {
  const value = String(raw ?? '').toLowerCase();
  return (PRESENTATION_LOCALES as readonly string[]).includes(value)
    ? (value as PresentationLocale)
    : 'ru';
}

/** Identity comes from the session, never from a parameter. */
async function requirePatient(req: AuthRequest, res: any): Promise<string | null> {
  const patient = await resolvePatientForUser(req.user!);
  if (!patient) {
    res.status(404).json({ ok: false, error: 'Карта пациента не найдена' } satisfies ApiResponse);
    return null;
  }
  return patient.id;
}

/** What the patient has to watch — one entry per published, unexpired release. */
patientPresentationRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const patientId = await requirePatient(req, res);
    if (!patientId) return;

    const releases = await listPublishedReleases(patientId);
    return res.json({
      ok: true,
      data: releases.map((r: any) => ({
        releaseId: r.id,
        planId: r.planId,
        version: r.version,
        totalAmount: r.totalAmount,
        approvedAt: r.approvedAt,
        expiresAt: r.expiresAt,
        clinic: r.clinic ?? null,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить планы' } satisfies ApiResponse);
  }
});

/**
 * The script itself.
 *
 * Built deterministically from the frozen snapshot on every read rather than
 * stored: with no LLM in the path the output is byte-identical each time, so a
 * cache would buy nothing and add a staleness mode. That changes when the LLM
 * rewrite lands — the generated wording has to be reviewed by the doctor and
 * pinned, and that is when it gets a table of its own.
 */
patientPresentationRouter.get('/:releaseId', async (req: AuthRequest, res) => {
  try {
    const patientId = await requirePatient(req, res);
    if (!patientId) return;

    const releaseId = String(req.params.releaseId);
    // Scoped by patientId as well as id, so another patient's release id
    // resolves to nothing rather than to a 403 that confirms it exists.
    const release = await getPublishedRelease(patientId, releaseId);
    if (!release) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }

    const [patient, clinic] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true } }),
      prisma.clinic.findUnique({ where: { id: release.clinicId }, select: { name: true } }),
    ]);

    const approver = await prisma.user.findUnique({
      where: { id: release.approvedByUserId },
      select: { firstName: true, lastName: true },
    });
    const doctorName = approver ? `${approver.firstName} ${approver.lastName}`.trim() : null;

    const script = buildScriptSkeleton({
      releaseId: release.id,
      snapshot: release.snapshot,
      patientFirstName: patient?.firstName ?? null,
      clinicName: clinic?.name ?? null,
      doctorName,
      locale: resolveLocale(req.query.locale),
      totalAmount: release.totalAmount,
    });

    return res.json({
      ok: true,
      data: {
        script,
        release: {
          releaseId: release.id,
          version: release.version,
          totalAmount: release.totalAmount,
          approvedAt: release.approvedAt,
          // Shown on screen: a quoted price is an offer and the patient is
          // entitled to know how long it stands.
          expiresAt: release.expiresAt,
        },
        snapshot: release.snapshot,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] script error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось построить презентацию' } satisfies ApiResponse);
  }
});
