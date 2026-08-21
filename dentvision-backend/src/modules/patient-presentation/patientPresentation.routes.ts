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
import { PRESENTATION_LOCALES, type PresentationLocale, type PresentationScript } from './beats.js';
import {
  getPublishedRelease,
  listPublishedReleases,
  recordPresentationMilestone,
  type PresentationMilestone,
} from './planRelease.service.js';
import { buildScriptForRelease } from './releaseScript.js';
import { resolveVoiceLines, voiceConfigured } from './voice.service.js';

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

/**
 * The script the patient actually sees for one release.
 *
 * Prefers a doctor-published `PatientPresentation` for the requested
 * locale — the reviewed, LLM-rewritten wording — and falls back to the
 * plain deterministic skeleton when no presentation was ever generated, or
 * one exists only as an unpublished draft. A draft is never patient-visible
 * by construction: this is the only place that reads `PatientPresentation`
 * on the patient's behalf, and it only ever looks at `status: 'published'`.
 */
async function resolveScriptForRelease(
  release: { id: string; clinicId: string; snapshot: unknown; totalAmount: number; approvedByUserId: string },
  patientId: string,
  locale: PresentationLocale,
): Promise<PresentationScript> {
  const presentation = await prisma.patientPresentation.findUnique({
    where: { releaseId_locale: { releaseId: release.id, locale } },
  });
  if (presentation && presentation.status === 'published') {
    return presentation.script as unknown as PresentationScript;
  }
  return buildScriptForRelease(release, patientId, locale);
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
 * Resolved fresh on every read, never cached: the deterministic skeleton is
 * rebuilt from the frozen snapshot each time, and a doctor-reviewed
 * `PatientPresentation` is looked up by its own primary key. Either way the
 * read is cheap enough that a cache would only add a staleness mode.
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

    const script = await resolveScriptForRelease(release, patientId, resolveLocale(req.query.locale));

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

/**
 * Narration for one act, synthesised on first play and cached by content.
 *
 * Per act rather than per presentation: most patients open act one, and paying
 * to synthesise six acts up front bills for narration nobody hears.
 *
 * A line with no audio comes back as `audioUrl: null` and the player falls
 * through to its estimated reading time. That is a normal outcome — storage not
 * configured, provider down, budget spent — and the patient never sees an error
 * for any of them.
 */
patientPresentationRouter.get('/:releaseId/voice', async (req: AuthRequest, res) => {
  try {
    const patientId = await requirePatient(req, res);
    if (!patientId) return;

    const release = await getPublishedRelease(patientId, String(req.params.releaseId));
    if (!release) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }

    const locale = resolveLocale(req.query.locale);
    const script = await resolveScriptForRelease(release, patientId, locale);

    const actId = req.query.act ? String(req.query.act) : null;
    const acts = actId ? script.acts.filter((a) => a.id === actId) : script.acts;
    const lines = acts.flatMap((act) => act.beats.map((b) => ({ beatId: b.id, text: b.say })));

    const results = await resolveVoiceLines(lines, locale);
    return res.json({ ok: true, data: { configured: voiceConfigured(), lines: results } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] voice error:', error);
    // Even here the patient gets a playable answer rather than a failure.
    return res.json({ ok: true, data: { configured: false, lines: [] } } satisfies ApiResponse);
  }
});

/**
 * The funnel's two touchpoints on the patient's side: opened it, watched it
 * through. `recordPresentationMilestone` already re-checks that this release
 * is really this patient's own published release, so a bad or someone
 * else's `releaseId` here quietly records nothing rather than 404ing — a
 * tracking call is not worth surfacing an error for.
 */
patientPresentationRouter.post('/:releaseId/track', async (req: AuthRequest, res) => {
  try {
    const patientId = await requirePatient(req, res);
    if (!patientId) return;

    const milestone = String((req.body || {}).event ?? '');
    if (milestone !== 'viewed' && milestone !== 'finished') {
      return res.status(400).json({ ok: false, error: 'Неизвестное событие' } satisfies ApiResponse);
    }

    await recordPresentationMilestone(patientId, String(req.params.releaseId), milestone as PresentationMilestone);
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] track error:', error);
    // Tracking is best-effort — the patient's experience never depends on it.
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  }
});
