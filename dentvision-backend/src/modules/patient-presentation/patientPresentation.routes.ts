/**
 * Patient-facing treatment-plan presentation.
 *
 * Published releases are bearer links: the release id is a random UUID and the
 * server still enforces approved + published + unexpired on every read. This
 * lets a clinic send a plan to a patient who has never registered in DentVision
 * while keeping mutable TreatmentPlan data behind the doctor approval boundary.
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

function resolveLocale(raw: unknown): PresentationLocale {
  const value = String(raw ?? '').toLowerCase();
  return (PRESENTATION_LOCALES as readonly string[]).includes(value)
    ? (value as PresentationLocale)
    : 'ru';
}

async function getPublicRelease(releaseId: string) {
  const now = new Date();
  return prisma.treatmentPlanRelease.findFirst({
    where: {
      id: releaseId,
      status: 'approved',
      publishedAt: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { clinic: { select: { id: true, name: true } } },
  });
}

/**
 * Public bearer-link read. No DentVision account is required: a published
 * release can be opened directly from WhatsApp. The UUID is the access token;
 * the database gate remains authoritative for withdrawal and expiry.
 */
patientPresentationRouter.get('/:releaseId', async (req: AuthRequest, res) => {
  try {
    const release = await getPublicRelease(String(req.params.releaseId));
    if (!release) {
      return res.status(404).json({ ok: false, error: 'План не найден или срок его действия истёк' } satisfies ApiResponse);
    }

    const script = await resolveScriptForRelease(release, release.patientId, resolveLocale(req.query.locale));
    return res.json({
      ok: true,
      data: {
        script,
        release: {
          releaseId: release.id,
          version: release.version,
          totalAmount: release.totalAmount,
          approvedAt: release.approvedAt,
          expiresAt: release.expiresAt,
        },
        snapshot: release.snapshot,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] public script error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось построить презентацию' } satisfies ApiResponse);
  }
});

/** Public narration for a published bearer link. */
patientPresentationRouter.get('/:releaseId/voice', async (req: AuthRequest, res) => {
  try {
    const release = await getPublicRelease(String(req.params.releaseId));
    if (!release) {
      return res.status(404).json({ ok: false, error: 'План не найден или срок его действия истёк' } satisfies ApiResponse);
    }

    const locale = resolveLocale(req.query.locale);
    const script = await resolveScriptForRelease(release, release.patientId, locale);
    const actId = req.query.act ? String(req.query.act) : null;
    const acts = actId ? script.acts.filter((a) => a.id === actId) : script.acts;
    const lines = acts.flatMap((act) => act.beats.map((b) => ({ beatId: b.id, text: b.say })));
    const results = await resolveVoiceLines(lines, locale);

    return res.json({ ok: true, data: { configured: voiceConfigured(), lines: results } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] public voice error:', error);
    return res.json({ ok: true, data: { configured: false, lines: [] } } satisfies ApiResponse);
  }
});

/** Public funnel tracking for a bearer-link visitor. Best-effort and idempotent. */
patientPresentationRouter.post('/:releaseId/track', async (req: AuthRequest, res) => {
  try {
    const release = await getPublicRelease(String(req.params.releaseId));
    if (!release) return res.json({ ok: true, data: null } satisfies ApiResponse);

    const milestone = String((req.body || {}).event ?? '');
    if (milestone !== 'viewed' && milestone !== 'finished') {
      return res.status(400).json({ ok: false, error: 'Неизвестное событие' } satisfies ApiResponse);
    }

    await recordPresentationMilestone(release.patientId, release.id, milestone as PresentationMilestone);
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[Presentation] public track error:', error);
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  }
});

patientPresentationRouter.use(authenticate);

/** Identity comes from the session, never from a parameter. */
async function requirePatient(req: AuthRequest, res: any): Promise<string | null> {
  const patient = await resolvePatientForUser(req.user!);
  if (!patient) {
    res.status(404).json({ ok: false, error: 'Карта пациента не найдена' } satisfies ApiResponse);
    return null;
  }
  return patient.id;
}

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

/** What the authenticated patient has to watch — one entry per release. */
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
