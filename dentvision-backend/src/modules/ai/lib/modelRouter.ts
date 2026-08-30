/**
 * Cheap-first OpenAI model router.
 *
 * Free-tier pools (typical OpenAI complimentary traffic):
 *   - full  ~250k tok/day
 *   - mini  ~2.5M tok/day
 *
 * Strategy: route almost everything through mini; escalate to full only for
 * hard clinic tasks, and stop escalating when the soft full-day budget is gone.
 */

import { counterKeys, incrementDaily, readDaily } from '../../../lib/dailyCounter.js';

export type ModelTier = 'mini' | 'full';
export type ModelMode = 'auto' | 'mini' | 'full';

export interface ModelChoice {
  model: string;
  tier: ModelTier;
  reasoningEffort: 'low' | 'medium' | 'high';
  /** False for models with no reasoning mode — the parameter is then omitted. */
  supportsReasoning: boolean;
  maxOutputTokens: number;
  reason: string;
}

/**
 * Which families take a `reasoning` parameter.
 *
 * It used to be sent unconditionally, including to `gpt-4o`, which has no
 * reasoning mode. Kept as a small maintained pattern rather than a per-model
 * table: a new family costs one alternative here.
 */
const REASONING_MODEL_RE = /^(o\d|gpt-5)/i;

export function supportsReasoning(model: string): boolean {
  return REASONING_MODEL_RE.test(String(model || '').trim());
}

export interface ModelUsageSnapshot {
  day: string;
  miniUsed: number;
  fullUsed: number;
  miniBudget: number;
  fullBudget: number;
}

const COMPLEX_RE =
  /анализ|стратег|сравни|почему|разбер|объясни подробно|план\s+лечен|дифференц|прогноз|аудит|оптимиз|риск|многошаг|комплексн|сводн(ый|ая)\s+отч[её]т|deep\s*dive|analyze|compare|why\b|treatment\s+plan/i;

const DEFAULT_MINI_BUDGET = 2_400_000;
const DEFAULT_FULL_BUDGET = 240_000;

let usageDay = '';
let miniUsed = 0;
let fullUsed = 0;
let configuredMiniBudget = DEFAULT_MINI_BUDGET;
let configuredFullBudget = DEFAULT_FULL_BUDGET;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDay(): void {
  const day = utcDay();
  if (usageDay !== day) {
    usageDay = day;
    miniUsed = 0;
    fullUsed = 0;
  }
}

/** Rough token estimate — good enough for soft daily budgets. */
export function estimateTokens(...parts: Array<string | null | undefined>): number {
  const chars = parts.reduce((n, p) => n + (p ? String(p).length : 0), 0);
  return Math.max(1, Math.ceil(chars / 4));
}

export function isComplexQuery(
  text: string,
  opts?: { isGuest?: boolean; historyTurns?: number },
): boolean {
  if (opts?.isGuest) return false;
  const t = String(text || '').trim();
  if (!t) return false;
  if (t.length >= 420) return true;
  if ((t.match(/\?/g) || []).length >= 2) return true;
  if ((opts?.historyTurns || 0) >= 10) return true;
  return COMPLEX_RE.test(t);
}

/**
 * Record what a call cost.
 *
 * Written to the shared daily counter when Redis is available, so the budget
 * is one number across instances instead of one per process, and survives a
 * restart. The in-memory tally is kept in step regardless — it is the fallback
 * and what `getModelUsageSnapshot` reports.
 */
export async function recordModelUsage(tier: ModelTier, tokens: number): Promise<void> {
  ensureDay();
  const n = Math.max(0, Math.floor(tokens));
  if (tier === 'full') fullUsed += n;
  else miniUsed += n;
  await incrementDaily(counterKeys.modelBudget(tier), n);
}

export function getModelUsageSnapshot(): ModelUsageSnapshot {
  ensureDay();
  return {
    day: usageDay || utcDay(),
    miniUsed,
    fullUsed,
    miniBudget: configuredMiniBudget,
    fullBudget: configuredFullBudget,
  };
}

/** Test helper — resets in-memory counters. */
export function __resetModelUsageForTests(): void {
  usageDay = '';
  miniUsed = 0;
  fullUsed = 0;
  configuredMiniBudget = DEFAULT_MINI_BUDGET;
  configuredFullBudget = DEFAULT_FULL_BUDGET;
}

export function pickModel(input: {
  task: 'orchestrate' | 'polish';
  text: string;
  isGuest?: boolean;
  historyTurns?: number;
  round?: number;
  toolsUsed?: number;
  /** Force escalate after a weak mini reply / empty output. */
  escalate?: boolean;
  mode?: ModelMode;
  /** Resolved by `modelCatalog`; required, so no stale default can win here. */
  miniModel: string;
  fullModel: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  miniUsed?: number;
  fullUsed?: number;
  miniBudget?: number;
  fullBudget?: number;
}): ModelChoice {
  ensureDay();
  const mode = input.mode ?? 'auto';
  const { miniModel, fullModel } = input;
  const effort = input.reasoningEffort ?? 'low';
  const miniBudget = input.miniBudget ?? configuredMiniBudget;
  const fullBudget = input.fullBudget ?? configuredFullBudget;
  const usedMini = input.miniUsed ?? miniUsed;
  const usedFull = input.fullUsed ?? fullUsed;

  const miniLeft = usedMini < miniBudget;
  const fullLeft = usedFull < fullBudget;

  const asMini = (reason: string, maxOut: number): ModelChoice => ({
    model: miniModel,
    tier: 'mini',
    reasoningEffort: 'low',
    supportsReasoning: supportsReasoning(miniModel),
    maxOutputTokens: maxOut,
    reason,
  });

  const asFull = (reason: string, maxOut: number): ModelChoice => ({
    model: fullModel,
    tier: 'full',
    reasoningEffort: effort,
    supportsReasoning: supportsReasoning(fullModel),
    maxOutputTokens: maxOut,
    reason,
  });

  // Polish / rewrite is always mini — wording only, no clinic planning.
  if (input.task === 'polish') {
    if (!miniLeft && fullLeft) return asFull('polish_mini_budget_exhausted', 500);
    return asMini('polish_always_mini', 500);
  }

  if (mode === 'mini') {
    if (!miniLeft && fullLeft) return asFull('forced_mini_but_budget_exhausted', 900);
    return asMini('mode_mini', 900);
  }
  if (mode === 'full') {
    if (!fullLeft && miniLeft) return asMini('mode_full_but_budget_exhausted', 900);
    return asFull('mode_full', 1200);
  }

  // Guests: product Q&A — never burn the 250k pool.
  if (input.isGuest) {
    if (!miniLeft && fullLeft) return asFull('guest_mini_budget_exhausted', 700);
    return asMini('guest_product_chat', 700);
  }

  const complex = isComplexQuery(input.text, {
    isGuest: input.isGuest,
    historyTurns: input.historyTurns,
  });
  const deepToolLoop = (input.round || 0) >= 2 && (input.toolsUsed || 0) >= 2;
  const wantFull = Boolean(input.escalate) || complex || deepToolLoop;

  if (wantFull && fullLeft) {
    return asFull(
      input.escalate
        ? 'escalate_after_weak_mini'
        : deepToolLoop
          ? 'deep_tool_loop'
          : 'complex_clinic_query',
      1200,
    );
  }

  if (!miniLeft && fullLeft) {
    return asFull('mini_budget_exhausted', 900);
  }

  return asMini(
    wantFull && !fullLeft ? 'want_full_but_budget_exhausted' : 'default_cheap',
    900,
  );
}

/** Production entry — resolved model ids + live env + soft in-process budgets. */
export async function chooseOpenAIModel(input: {
  task: 'orchestrate' | 'polish';
  text: string;
  isGuest?: boolean;
  historyTurns?: number;
  round?: number;
  toolsUsed?: number;
  escalate?: boolean;
}): Promise<ModelChoice> {
  const { env } = await import('../../../config.js');
  const { resolveModels } = await import('./modelCatalog.js');
  configuredMiniBudget = env.OPENAI_DAILY_MINI_TOKENS;
  configuredFullBudget = env.OPENAI_DAILY_FULL_TOKENS;

  // Which ids exist is the catalog's business; which tier to use is this
  // file's. Keeping them apart is what stopped two places from disagreeing.
  const models = await resolveModels({
    apiKey: env.OPENAI_API_KEY,
    envFull: env.OPENAI_MODEL,
    envMini: env.OPENAI_MODEL_MINI,
  });

  // Read the shared spend here and hand it to `pickModel` through the
  // parameters it already had. That keeps `pickModel` a pure synchronous
  // function — which is how its 21 existing tests exercise it — while the
  // budget it consults becomes cluster-wide.
  const [sharedMini, sharedFull] = await Promise.all([
    readDaily(counterKeys.modelBudget('mini')),
    readDaily(counterKeys.modelBudget('full')),
  ]);

  return pickModel({
    ...input,
    mode: env.OPENAI_MODEL_MODE,
    miniModel: models.mini,
    fullModel: models.full,
    reasoningEffort: env.OPENAI_REASONING_EFFORT,
    ...(sharedMini !== null ? { miniUsed: sharedMini } : {}),
    ...(sharedFull !== null ? { fullUsed: sharedFull } : {}),
  });
}
