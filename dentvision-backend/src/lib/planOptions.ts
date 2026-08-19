/**
 * Essential / Optimal / Premium, assembled from the plan rather than authored.
 *
 * The doctor does one small thing: against a line item they mark alternatives
 * from the clinic's own price list and leave their own choice in the plan. The
 * three levels are then derived here — deterministically, with no LLM and no
 * clinician judgement of ours:
 *
 *   **Optimal**   — exactly what the doctor put in the plan. Never modified.
 *   **Essential** — the cheapest `essential`-tier alternative per line, used
 *                   only where it is genuinely cheaper than the doctor's choice.
 *   **Premium**   — the dearest `premium`-tier alternative per line, used only
 *                   where it is genuinely dearer.
 *
 * **One arithmetic, not two.** Every total here runs through the same
 * `lineItemTotal` as the plan itself, with only `price` substituted — so units
 * still come from the teeth or `qty` on the line, and a level physically cannot
 * disagree with the plan about what a crown on three teeth costs. A second
 * pricing path is the thing this file exists to avoid.
 *
 * A level that ends up identical to the doctor's plan is marked
 * `sameAsOptimal`, and the presentation must not offer it as a choice: showing
 * a patient three prices that are the same number is worse than showing one.
 */

import {
  lineItemTotal,
  type TreatmentPlanAlternative,
  type TreatmentPlanLineItem,
  type TreatmentPlanStage,
} from './treatmentPlanShape.js';

export type PlanOptionKey = 'essential' | 'optimal' | 'premium';

export const PLAN_OPTION_KEYS: readonly PlanOptionKey[] = ['essential', 'optimal', 'premium'];

export interface PlanOptionChoice {
  stageId: string;
  itemId: string;
  serviceId: string;
  serviceName: string;
  /** Unit price for this level. Units still come from the line's teeth/qty. */
  price: number;
  /** Line total at this level, via the plan's own arithmetic. */
  total: number;
  /** `plan` means the doctor's own line was kept for this level. */
  source: 'plan' | 'alternative';
}

export interface PlanOption {
  key: PlanOptionKey;
  total: number;
  choices: PlanOptionChoice[];
  /** True when this level is, line for line, the doctor's own plan. */
  sameAsOptimal: boolean;
}

function cheapestEssential(alternatives: TreatmentPlanAlternative[]): TreatmentPlanAlternative | null {
  const tier = alternatives.filter((a) => a.tier === 'essential');
  if (tier.length === 0) return null;
  return tier.reduce((best, a) => (a.price < best.price ? a : best));
}

function dearestPremium(alternatives: TreatmentPlanAlternative[]): TreatmentPlanAlternative | null {
  const tier = alternatives.filter((a) => a.tier === 'premium');
  if (tier.length === 0) return null;
  return tier.reduce((best, a) => (a.price > best.price ? a : best));
}

/**
 * Which service a level uses for one line.
 *
 * The direction check matters: an "essential" alternative priced above the
 * doctor's own choice would make the cheap level the expensive one, and a
 * mislabelled price-list row is a mistake we should absorb rather than show.
 */
function chooseForLine(
  item: TreatmentPlanLineItem,
  key: PlanOptionKey,
): TreatmentPlanAlternative | null {
  const alternatives = item.alternatives ?? [];
  if (key === 'optimal' || alternatives.length === 0) return null;
  const planPrice = Number(item.price) || 0;
  if (key === 'essential') {
    const alt = cheapestEssential(alternatives);
    return alt && alt.price < planPrice ? alt : null;
  }
  const alt = dearestPremium(alternatives);
  return alt && alt.price > planPrice ? alt : null;
}

function buildOption(stages: TreatmentPlanStage[], key: PlanOptionKey): PlanOption {
  const choices: PlanOptionChoice[] = [];
  let total = 0;
  let differs = false;

  for (const stage of stages) {
    for (const item of stage.items || []) {
      const alt = chooseForLine(item, key);
      // Only `price` is substituted — units stay with the line, so the same
      // `lineItemTotal` governs every level.
      const lineTotal = lineItemTotal(alt ? { ...item, price: alt.price } : item);
      if (alt) differs = true;
      total += lineTotal;
      choices.push({
        stageId: String(stage.id ?? ''),
        itemId: String(item.id ?? ''),
        serviceId: String((alt ? alt.serviceId : item.serviceId) ?? ''),
        serviceName: String((alt ? alt.serviceName : item.serviceName || item.name) ?? ''),
        price: alt ? alt.price : Number(item.price) || 0,
        total: lineTotal,
        source: alt ? 'alternative' : 'plan',
      });
    }
  }

  return { key, total, choices, sameAsOptimal: !differs };
}

/**
 * All three levels, always in the same order, always including `optimal`.
 *
 * Levels are returned even when they match the plan; the caller decides whether
 * a level worth showing exists (`hasRealChoice`). Returning them unconditionally
 * keeps the snapshot's shape stable across plans, which matters because the
 * snapshot is hashed.
 */
export function buildPlanOptions(stages: TreatmentPlanStage[]): PlanOption[] {
  return PLAN_OPTION_KEYS.map((key) => buildOption(stages, key));
}

/** Is there anything here a patient could actually choose between? */
export function hasRealChoice(options: PlanOption[]): boolean {
  return options.some((o) => o.key !== 'optimal' && !o.sameAsOptimal);
}

/** The levels worth putting on screen: the doctor's, plus any that differ. */
export function presentableOptions(options: PlanOption[]): PlanOption[] {
  if (!hasRealChoice(options)) return [];
  return options.filter((o) => o.key === 'optimal' || !o.sameAsOptimal);
}
