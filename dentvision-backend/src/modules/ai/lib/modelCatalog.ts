/**
 * Which model to actually call.
 *
 * The problem this solves: production ran a two-year-old model without anyone
 * choosing it. `modelRouter` declared `gpt-5.4`, but those constants were
 * unreachable — `chooseOpenAIModel` always passed `env.OPENAI_MODEL*`, which
 * always resolved because `config.ts` gave them defaults, so the `??` never
 * fired. `render.yaml` set no model variables at all. Two sources of truth,
 * and the older one silently won every time.
 *
 * The fix is to ask the provider. `/v1/models` answers *what this account may
 * call*; it does not answer what those models can do. So the capability half
 * stays here as an ordered list, and the availability half comes from the
 * probe.
 *
 * The ladder is deliberately a **superset**. An id that this account cannot
 * call is simply never selected, so listing one costs nothing — while omitting
 * a real one means it can never be picked. Adding a newer model is one line;
 * nothing else has to change.
 */

import { safeErrorKind } from '../../../lib/safeError.js';

export interface ModelCandidate {
  /** Exact id sent as `model`. */
  id: string;
  /** Accepts image input — required for radiograph analysis. */
  vision: boolean;
  /** Supports the Responses API reasoning parameter. Never infer from a name prefix. */
  reasoning: boolean;
}

/**
 * Best first. The last entry is the floor: it is what gets used when the probe
 * cannot run, and it must therefore be a model that has been around long
 * enough to be safe to assume.
 */
export const FULL_LADDER: readonly ModelCandidate[] = [
  // Sol is positioned as the everyday agent model. The API probe decides
  // whether the exact account may call the current or previous version.
  { id: 'gpt-6.2-sol', vision: false, reasoning: false },
  { id: 'gpt-6.1-sol', vision: false, reasoning: true },
  { id: 'gpt-6.2-astra', vision: false, reasoning: true },
  { id: 'gpt-6-astra', vision: false, reasoning: true },
  // Terra is the dedicated visual-reasoning choice for radiograph/image work.
  { id: 'gpt-6.1-terra', vision: true, reasoning: true },
  { id: 'gpt-5.6-sol', vision: false, reasoning: true },
  { id: 'gpt-5.4', vision: true, reasoning: true },
  { id: 'gpt-5', vision: true, reasoning: true },
  { id: 'gpt-4.1', vision: true, reasoning: false },
  { id: 'o3', vision: false, reasoning: true },
  { id: 'gpt-4o', vision: true, reasoning: false },
];

/** Highest-reasoning tier, reserved for deep clinical/strategic work. */
export const DEEP_LADDER: readonly ModelCandidate[] = [
  { id: 'gpt-6.2-astra', vision: false, reasoning: true },
  { id: 'gpt-6-astra', vision: false, reasoning: true },
  { id: 'gpt-5.6-sol', vision: false, reasoning: true },
  { id: 'gpt-5.4', vision: true, reasoning: true },
  { id: 'o3', vision: false, reasoning: true },
];

export const MINI_LADDER: readonly ModelCandidate[] = [
  // Luna is the efficient high-volume tier; older IDs remain safe fallbacks.
  { id: 'gpt-6-luna', vision: false, reasoning: false },
  { id: 'gpt-5.4-mini', vision: true, reasoning: true },
  { id: 'gpt-5-mini', vision: true, reasoning: true },
  { id: 'gpt-4.1-mini', vision: true, reasoning: false },
  { id: 'o4-mini', vision: false, reasoning: true },
  { id: 'gpt-4o-mini', vision: true, reasoning: false },
];

/**
 * Embedding models, best first.
 *
 * The floor is the oldest widely-available one, so a probe that finds nothing
 * newer still yields working search rather than none. `text-embedding-3-small`
 * is what the repo's own (now deleted) knowledge module named as the intended
 * replacement for its hand-rolled hash.
 */
export const EMBEDDING_LADDER: readonly string[] = [
  'text-embedding-3-large',
  // The small v3 model is the conservative floor when discovery is degraded.
  'text-embedding-3-small',
];

/**
 * Speech-to-text models, best first. `whisper-1` is the floor for the same
 * reason as elsewhere: long-lived and safe to assume when a probe finds
 * nothing newer.
 */
export const TRANSCRIPTION_LADDER: readonly string[] = [
  'gpt-transcribe',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  'whisper-1',
];

export interface ResolvedModels {
  full: string;
  mini: string;
  /** Best available model that accepts images, or null when none does. */
  vision: string | null;
  fullSupportsReasoning: boolean;
  deep: string;
  deepSupportsReasoning: boolean;
  miniSupportsReasoning: boolean;
  visionSupportsReasoning: boolean;
  /** Best available embedding model. */
  embedding: string;
  /** Best available speech-to-text model. */
  transcription: string;
  /** `env` when an operator pinned the ids, `probe` when they were discovered. */
  source: 'env' | 'probe';
  /** True when the probe failed and the ladder floor is standing in. */
  degraded: boolean;
  resolvedAt: number;
}

const MODELS_URL = 'https://api.openai.com/v1/models';
const PROBE_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cached: ResolvedModels | null = null;
let inFlight: Promise<ResolvedModels> | null = null;

/** Test helper — drops the cache and any in-flight probe. */
export function __resetModelCatalogForTests(): void {
  cached = null;
  inFlight = null;
}

/** Last resolution, without triggering one. Null before the first resolve. */
export function getResolvedModels(): ResolvedModels | null {
  return cached;
}

function floorOf(ladder: readonly ModelCandidate[]): ModelCandidate {
  return ladder[ladder.length - 1];
}

/** Top-most ladder entry the account can actually call. */
function pickAvailable(
  ladder: readonly ModelCandidate[],
  available: Set<string>,
): ModelCandidate | null {
  return ladder.find((c) => available.has(c.id)) ?? null;
}

async function probeAvailableModels(apiKey: string): Promise<Set<string>> {
  const res = await fetch(MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  const payload = (await res.json()) as { data?: Array<{ id?: string }> };
  return new Set((payload.data ?? []).map((m) => String(m?.id ?? '')).filter(Boolean));
}

export interface ResolveOptions {
  apiKey?: string | null;
  /** Operator pin. Pins override chat tiers; discovery still resolves auxiliary models. */
  envFull?: string | null;
  envMini?: string | null;
  force?: boolean;
}

/**
 * Resolve the model ids to use, cached for six hours.
 *
 * An explicit env pin always wins for its chat tier. The provider probe still
 * runs to discover independent vision, embedding and transcription models;
 * pinning chat must not silently force those capabilities to obsolete floors.
 * Otherwise the chat ladders are intersected with what the account has. A failed
 * probe is reported safely and falls back to the ladder
 * floor — refusing to answer at all would take the whole assistant down over a
 * metadata call, but the failure must never pass unnoticed, which is what
 * `degraded` is for.
 */
export async function resolveModels(opts: ResolveOptions = {}): Promise<ResolvedModels> {
  const now = Date.now();
  if (!opts.force && cached && now - cached.resolvedAt < CACHE_TTL_MS) return cached;
  if (!opts.force && inFlight) return inFlight;

  const run = async (): Promise<ResolvedModels> => {
    const envFull = opts.envFull?.trim() || '';
    const envMini = opts.envMini?.trim() || '';

    const known = [...FULL_LADDER, ...MINI_LADDER];
    const pinnedVision = [envFull, envMini]
      .map((id) => known.find((candidate) => candidate.id === id && candidate.vision))
      .find((candidate) => candidate !== undefined);

    const selectedFull = FULL_LADDER.find((candidate) => candidate.id === envFull) ?? floorOf(FULL_LADDER);
    const selectedDeep = [...DEEP_LADDER, ...FULL_LADDER].find((candidate) => candidate.id === envFull) ?? selectedFull;
    const selectedMini = MINI_LADDER.find((candidate) => candidate.id === envMini) ?? floorOf(MINI_LADDER);
    const fallbackVision = pinnedVision ?? floorOf(FULL_LADDER);

    const fallback = (degraded: boolean): ResolvedModels => ({
      full: envFull || selectedFull.id,
      deep: envFull || selectedDeep.id,
      mini: envMini || selectedMini.id,
      vision: fallbackVision.id,
      fullSupportsReasoning: selectedFull.reasoning,
      deepSupportsReasoning: selectedDeep.reasoning,
      miniSupportsReasoning: selectedMini.reasoning,
      visionSupportsReasoning: fallbackVision.reasoning,
      embedding: EMBEDDING_LADDER[EMBEDDING_LADDER.length - 1],
      transcription: TRANSCRIPTION_LADDER[TRANSCRIPTION_LADDER.length - 1],
      source: envFull || envMini ? 'env' : 'probe',
      degraded,
      resolvedAt: Date.now(),
    });

    if (!opts.apiKey) return fallback(false);

    try {
      const available = await probeAvailableModels(opts.apiKey);
      const full = envFull ? null : pickAvailable(FULL_LADDER, available);
      const deep = envFull ? null : pickAvailable(DEEP_LADDER, available);
      const mini = envMini ? null : pickAvailable(MINI_LADDER, available);

      if (!envFull && !full && !envMini && !mini) {
        console.error(
          '[modelCatalog] No model from the preference ladder is available to this account. ' +
            `Falling back to ${floorOf(FULL_LADDER).id}/${floorOf(MINI_LADDER).id}. ` +
            'Pin OPENAI_MODEL and OPENAI_MODEL_MINI, or extend the ladder.',
        );
        return fallback(true);
      }

      const visionCandidate =
        [...FULL_LADDER, ...MINI_LADDER].find((c) => c.vision && available.has(c.id)) ?? null;
      const selectedFull = envFull
        ? [...FULL_LADDER, ...MINI_LADDER].find((candidate) => candidate.id === envFull)
        : full;
      const selectedDeep = envFull
        ? [...DEEP_LADDER, ...FULL_LADDER].find((candidate) => candidate.id === envFull) ?? selectedFull
        : deep ?? full;
      const selectedMini = envMini
        ? [...FULL_LADDER, ...MINI_LADDER].find((candidate) => candidate.id === envMini)
        : mini;

      const resolved: ResolvedModels = {
        full: envFull || full?.id || floorOf(FULL_LADDER).id,
        deep: envFull || deep?.id || full?.id || floorOf(FULL_LADDER).id,
        mini: envMini || mini?.id || floorOf(MINI_LADDER).id,
        vision: visionCandidate?.id ?? null,
        fullSupportsReasoning: selectedFull?.reasoning ?? false,
        deepSupportsReasoning: selectedDeep?.reasoning ?? selectedFull?.reasoning ?? false,
        miniSupportsReasoning: selectedMini?.reasoning ?? false,
        visionSupportsReasoning: visionCandidate?.reasoning ?? false,
        embedding:
          EMBEDDING_LADDER.find((id) => available.has(id)) ??
          EMBEDDING_LADDER[EMBEDDING_LADDER.length - 1],
        transcription:
          TRANSCRIPTION_LADDER.find((id) => available.has(id)) ??
          TRANSCRIPTION_LADDER[TRANSCRIPTION_LADDER.length - 1],
        source: envFull || envMini ? 'env' : 'probe',
        degraded: false,
        resolvedAt: Date.now(),
      };
      console.warn(
        `[modelCatalog] models resolved: full=${resolved.full} mini=${resolved.mini} ` +
          `vision=${resolved.vision ?? 'none'}`,
      );
      return resolved;
    } catch (error) {
      console.error('[modelCatalog] /v1/models probe failed (' + safeErrorKind(error) + ')');
      return fallback(true);
    }
  };

  inFlight = run()
    .then((result) => {
      cached = result;
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
