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

export type ModelTier = 'mini' | 'full';
export type ModelMode = 'auto' | 'mini' | 'full';

export interface ModelChoice {
  model: string;
  tier: ModelTier;
  reasoningEffort: 'low' | 'medium' | 'high';
  maxOutputTokens: number;
  reason: string;
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

const DEFAULT_MINI_MODEL = 'gpt-5.4-mini';
const DEFAULT_FULL_MODEL = 'gpt-5.4';
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

export function recordModelUsage(tier: ModelTier, tokens: number): void {
  ensureDay();
  const n = Math.max(0, Math.floor(tokens));
  if (tier === 'full') fullUsed += n;
  else miniUsed += n;
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
  miniModel?: string;
  fullModel?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  miniUsed?: number;
  fullUsed?: number;
  miniBudget?: number;
  fullBudget?: number;
}): ModelChoice {
  ensureDay();
  const mode = input.mode ?? 'auto';
  const miniModel = input.miniModel ?? DEFAULT_MINI_MODEL;
  const fullModel = input.fullModel ?? DEFAULT_FULL_MODEL;
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
    maxOutputTokens: maxOut,
    reason,
  });

  const asFull = (reason: string, maxOut: number): ModelChoice => ({
    model: fullModel,
    tier: 'full',
    reasoningEffort: effort,
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

/** Production entry — reads live env + soft in-process budgets. */
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
  configuredMiniBudget = env.OPENAI_DAILY_MINI_TOKENS;
  configuredFullBudget = env.OPENAI_DAILY_FULL_TOKENS;
  return pickModel({
    ...input,
    mode: env.OPENAI_MODEL_MODE,
    miniModel: env.OPENAI_MODEL_MINI,
    fullModel: env.OPENAI_MODEL,
    reasoningEffort: env.OPENAI_REASONING_EFFORT,
  });
}
