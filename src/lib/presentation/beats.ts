/**
 * The Digital Human Layer contract.
 *
 * A presentation is a list of **beats**. A beat pairs one line of speech with a
 * stage direction — where to look, what to highlight — and with `refs`, the
 * provenance of every fact the line states.
 *
 * `camera` and `emphasis` are *intents, not pixels*. That is what makes the
 * renderer swappable: the 2D surface maps `zoom: 'close'` to a transform, a 3D
 * one would map it to a camera, and a photoreal avatar maps `say` to visemes.
 * None of them changes the script.
 *
 * `refs` exist so that a later LLM pass can only rephrase what is already
 * here. A validator checks every number and tooth in the rewritten line against
 * this list; anything it cannot trace is rejected and the template line stands.
 *
 * Mirrored verbatim from `dentvision-backend/src/modules/patient-presentation/beats.ts`.
 * The two are asserted to agree in the backend beatsParity.test.ts. The projects
 * do not share a build, and the renderer needs these types.
 */

export type ActId = 'overview' | 'findings' | 'consequences' | 'solution' | 'options' | 'next_step';

/**
 * How soon the doctor placed this work, derived from the stage order they
 * themselves set — never from a rule engine's opinion about a tooth. The
 * clinician's staging *is* the priority; re-deriving it would put a machine
 * clinical judgement in front of the patient.
 */
export type BeatPriority = 'now' | 'plan' | 'watch';

export interface StageDirection {
  scene: 'arches' | 'tooth_focus' | 'quadrant' | 'timeline' | 'options' | 'closing';
  /** FDI numbers to light up. */
  highlightTeeth?: number[];
  emphasis?: { priority?: BeatPriority };
  camera?: {
    focus: 'full_arches' | 'upper' | 'lower' | 'teeth' | 'none';
    zoom?: 'wide' | 'medium' | 'close';
  };
  stageId?: string;
  optionKey?: 'essential' | 'optimal' | 'premium';
}

export type BeatRef =
  | { kind: 'tooth'; fdi: number }
  | { kind: 'stage'; stageId: string }
  | { kind: 'lineItem'; stageId: string; itemId: string }
  | { kind: 'price'; amount: number; of: 'plan' | 'stage' | 'item' | 'option'; id?: string }
  /** The doctor's own words, quoted verbatim and never re-authored. */
  | { kind: 'diagnosisText' }
  | { kind: 'consultationNote' }
  | { kind: 'consequence'; libraryKey: string; version: string }
  | { kind: 'clinicPolicy'; key: 'financing' | 'warranty' | 'contact' | 'disclaimer' };

export interface Beat {
  /** Stable across regeneration: the TTS cache key and the funnel's beatId. */
  id: string;
  actId: ActId;
  order: number;
  /** 1–3 sentences, ≤320 characters. */
  say: string;
  /** The "explain it more simply" variant, when one is worth having. */
  saySimple?: string;
  /** Playback timing when there is no audio — the presentation must still run. */
  estimatedMs: number;
  stage: StageDirection;
  caption?: { text: string; kind: 'price' | 'tooth' | 'stage' | 'label' };
  interrupt?: { allowed: boolean; prompts?: string[] };
  /** Provenance. Every fact in `say` traces to one of these. */
  refs: BeatRef[];
}

export interface PresentationAct {
  id: ActId;
  title: string;
  beats: Beat[];
}

export interface PresentationScript {
  version: 1;
  locale: PresentationLocale;
  releaseId: string;
  personaName: string;
  acts: PresentationAct[];
}

export type PresentationLocale = 'ru' | 'kk' | 'en';

export const PRESENTATION_LOCALES: readonly PresentationLocale[] = ['ru', 'kk', 'en'];

/** Cheap reading-time estimate, used when no audio has been synthesised. */
export const MS_PER_CHARACTER = 55;
export const MIN_BEAT_MS = 2200;

export function estimateBeatMs(say: string): number {
  return Math.max(MIN_BEAT_MS, Math.round(say.length * MS_PER_CHARACTER));
}

/** The hard limits the validator enforces on any rewritten line. */
export const MAX_BEAT_CHARS = 320;
export const MAX_BEAT_SENTENCES = 3;

export function countSentences(say: string): number {
  const matches = say.trim().match(/[.!?…]+(\s|$)/g);
  return matches ? matches.length : say.trim() ? 1 : 0;
}

export function beatWithinLimits(say: string): boolean {
  return say.length <= MAX_BEAT_CHARS && countSentences(say) <= MAX_BEAT_SENTENCES;
}

/**
 * A beat that quotes the doctor rather than describing the plan.
 *
 * The number-provenance rule does not apply to these — a diagnosis is the
 * clinician's own words and may contain anything, including a tooth number, as
 * in "Хронический периодонтит 16". They get a **stricter** rule instead: the
 * line must reproduce the source text exactly, so a later LLM pass may not
 * rephrase it at all. That is the only safe way to carry a diagnosis into a
 * patient-facing script — quote it or omit it, never re-author it.
 */
export function isVerbatimQuote(beat: Pick<Beat, 'refs'>): boolean {
  return beat.refs.some((r) => r.kind === 'diagnosisText' || r.kind === 'consultationNote');
}

/** Every FDI tooth number a beat is allowed to mention. */
export function teethInRefs(refs: BeatRef[]): number[] {
  return refs.filter((r): r is Extract<BeatRef, { kind: 'tooth' }> => r.kind === 'tooth').map((r) => r.fdi);
}

/** Every amount a beat is allowed to state. */
export function amountsInRefs(refs: BeatRef[]): number[] {
  return refs.filter((r): r is Extract<BeatRef, { kind: 'price' }> => r.kind === 'price').map((r) => r.amount);
}
