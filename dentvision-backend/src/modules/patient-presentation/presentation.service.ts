/**
 * The doctor-facing half of Phase 5: generate, review, edit and publish a
 * `PatientPresentation`.
 *
 * Publishing a presentation is a second, separate act from publishing the
 * release (`planRelease.publishRelease`): a doctor may approve a plan and
 * let the patient see the plain deterministic wording without ever
 * generating one. Once a presentation is generated it stays a draft —
 * invisible to the patient, `patientPresentation.routes.ts` only ever reads
 * `status: 'published'` — until a doctor reviews it here and publishes it
 * explicitly.
 */

import type { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { normalizePlanItems } from '../../lib/treatmentPlanShape.js';
import { isVerbatimQuote, type Beat, type PresentationLocale, type PresentationScript } from './beats.js';
import { publishRelease, PlanReleaseError } from './planRelease.service.js';
import { rewriteScript } from './presentationGenerator.js';
import { buildScriptForRelease } from './releaseScript.js';
import { applyRewrite, validateBeat, type ScriptReview } from './scriptValidator.js';

export type GeneratorTag = 'template' | 'llm' | 'doctor';

export class PresentationError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'PresentationError';
  }
}

function allBeats(script: PresentationScript): Beat[] {
  return script.acts.flatMap((act) => act.beats);
}

function templateGeneratorMap(script: PresentationScript): Record<string, GeneratorTag> {
  const map: Record<string, GeneratorTag> = {};
  for (const beat of allBeats(script)) map[beat.id] = 'template';
  return map;
}

/** Redistribute a flat, order-preserved beat list back into its acts. */
function reassemble(script: PresentationScript, flatBeats: Beat[]): PresentationScript['acts'] {
  let i = 0;
  return script.acts.map((act) => ({ ...act, beats: act.beats.map(() => flatBeats[i++]) }));
}

/** The doctor's diagnosis text, exactly as `scriptSkeleton.ts` reads it. */
function extractDiagnosisText(snapshot: unknown): string | null {
  const diagnosis = normalizePlanItems(snapshot).diagnosis;
  return diagnosis ? String(diagnosis).trim() : null;
}

async function loadApprovedRelease(releaseId: string) {
  const release = await prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
  if (!release) throw new PresentationError('NOT_FOUND', 'Публикация не найдена');
  if (release.status !== 'approved') {
    throw new PresentationError('CONFLICT', 'Эта версия плана больше не активна');
  }
  return release;
}

/**
 * Build the skeleton, run the LLM pass, validate every rewrite, and store
 * the result as a draft. Regenerating an already-published presentation
 * resets it to `draft` — the new wording never reaches the patient until a
 * doctor publishes it again, the same as the first time.
 */
export async function generatePresentation(
  releaseId: string,
  actorUserId: string,
  locale: PresentationLocale = 'ru',
) {
  const release = await loadApprovedRelease(releaseId);
  const skeleton = await buildScriptForRelease(release, release.patientId, locale);

  const rewrites = await rewriteScript(skeleton);
  const generatorByBeat = templateGeneratorMap(skeleton);

  let script: PresentationScript = skeleton;
  let review: ScriptReview | null = null;

  if (rewrites && rewrites.size > 0) {
    const diagnosisText = extractDiagnosisText(release.snapshot);
    const result = applyRewrite(allBeats(skeleton), rewrites, diagnosisText, locale);
    review = result.review;
    script = { ...skeleton, acts: reassemble(skeleton, result.beats) };
    // A wholesale fallback reverts every beat to the template, so nothing
    // here is actually LLM wording even though some entries in the review
    // are individually marked `accepted` — the ratio, not the per-beat
    // verdict, decided the outcome.
    if (!review.fellBackWholesale) {
      for (const r of review.beats) {
        if (r.accepted) generatorByBeat[r.beatId] = 'llm';
      }
    }
  }

  const base = {
    clinicId: release.clinicId,
    status: 'draft' as const,
    script: script as unknown as Prisma.InputJsonValue,
    generatorByBeat: generatorByBeat as unknown as Prisma.InputJsonValue,
    validationReport: (review as unknown as Prisma.InputJsonValue | null) ?? undefined,
    generatedByUserId: actorUserId,
    generatedAt: new Date(),
  };

  return prisma.patientPresentation.upsert({
    where: { releaseId_locale: { releaseId: release.id, locale } },
    create: { releaseId: release.id, locale, ...base },
    // A regenerated draft is not published wording, whatever it replaced.
    update: { ...base, publishedByUserId: null, publishedAt: null },
  });
}

/** What the doctor's preview screen reads. */
export async function getPresentation(releaseId: string, locale: PresentationLocale = 'ru') {
  return prisma.patientPresentation.findUnique({
    where: { releaseId_locale: { releaseId, locale } },
  });
}

/**
 * A doctor's own rewording of one line. Always saved, tagged
 * `generator: 'doctor'` — the validator's opinion is recorded for
 * transparency in `validationReport`, never used to block the save, because
 * the doctor is the source of clinical truth here, not a check on it.
 */
export async function editBeat(
  presentationId: string,
  beatId: string,
  candidate: { say: string; saySimple?: string | null },
) {
  const row = await prisma.patientPresentation.findUnique({ where: { id: presentationId } });
  if (!row) throw new PresentationError('NOT_FOUND', 'Презентация не найдена');

  const script = row.script as unknown as PresentationScript;
  let found: Beat | null = null;
  const say = candidate.say.trim();
  const saySimple = candidate.saySimple?.trim();
  const acts = script.acts.map((act) => ({
    ...act,
    beats: act.beats.map((b) => {
      if (b.id !== beatId) return b;
      found = b;
      return { ...b, say, ...(saySimple ? { saySimple } : { saySimple: undefined }) };
    }),
  }));
  if (!found) throw new PresentationError('NOT_FOUND', 'Реплика не найдена');

  const release = await prisma.treatmentPlanRelease.findUnique({ where: { id: row.releaseId } });
  const diagnosisText = release ? extractDiagnosisText(release.snapshot) : null;
  const result = validateBeat({
    beat: found,
    candidate: { say, saySimple: saySimple ?? null },
    diagnosisText,
    locale: script.locale,
  });

  const generatorByBeat = {
    ...(row.generatorByBeat as Record<string, GeneratorTag>),
    [beatId]: 'doctor' as GeneratorTag,
  };

  const prior = (row.validationReport as unknown as ScriptReview | null) ?? null;
  const beats = (prior?.beats ?? []).filter((b) => b.beatId !== beatId);
  beats.push({ beatId, accepted: result.ok, failures: result.failures });
  const validationReport: ScriptReview = {
    beats,
    acceptedCount: beats.filter((b) => b.accepted).length,
    rejectedCount: beats.filter((b) => !b.accepted).length,
    fellBackWholesale: prior?.fellBackWholesale ?? false,
  };

  return prisma.patientPresentation.update({
    where: { id: presentationId },
    data: {
      script: { ...script, acts } as unknown as Prisma.InputJsonValue,
      generatorByBeat: generatorByBeat as unknown as Prisma.InputJsonValue,
      validationReport: validationReport as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Let the patient see it. Also publishes the underlying release if that
 * had not happened yet — `publishRelease` is idempotent, so a clinic that
 * already published the release separately sees no change to it here.
 */
export async function publishPresentation(presentationId: string, actorUserId: string) {
  const row = await prisma.patientPresentation.findUnique({ where: { id: presentationId } });
  if (!row) throw new PresentationError('NOT_FOUND', 'Презентация не найдена');

  try {
    await publishRelease(row.releaseId);
  } catch (error) {
    if (error instanceof PlanReleaseError) {
      throw new PresentationError(error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', error.message);
    }
    throw error;
  }

  return prisma.patientPresentation.update({
    where: { id: presentationId },
    data: { status: 'published', publishedByUserId: actorUserId, publishedAt: new Date() },
  });
}
