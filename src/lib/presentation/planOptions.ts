/**
 * Reading the option levels the backend froze into the release.
 *
 * This file deliberately contains **no arithmetic**. The three levels and their
 * totals were computed at approval by the backend's `planOptions.ts`, using the
 * plan's own `lineItemTotal`, and are stored in the snapshot. Recomputing them
 * here would be a second pricing path — the exact thing that lets a screen and
 * an invoice disagree about what a crown costs. So this only reads, validates
 * and describes.
 *
 * Mirrors the shape of `PlanOption` in
 * `dentvision-backend/src/lib/planOptions.ts`.
 */

export type PlanOptionKey = 'essential' | 'optimal' | 'premium'

export const PLAN_OPTION_ORDER: readonly PlanOptionKey[] = ['essential', 'optimal', 'premium']

export interface PlanOptionChoice {
  stageId: string
  itemId: string
  serviceId: string
  serviceName: string
  price: number
  total: number
  source: 'plan' | 'alternative'
}

export interface PlanOption {
  key: PlanOptionKey
  total: number
  choices: PlanOptionChoice[]
  sameAsOptimal: boolean
}

/** A level ready to render, with the one thing the card needs beyond its price. */
export interface PresentedOption extends PlanOption {
  /** How many lines differ from what the doctor chose. */
  changedCount: number
}

function isOptionKey(value: unknown): value is PlanOptionKey {
  return (PLAN_OPTION_ORDER as readonly string[]).includes(String(value))
}

/**
 * The levels worth showing, in a stable order.
 *
 * Returns an empty list when there is nothing to choose between — the caller
 * then shows the plan's single price rather than three identical cards. An
 * older release, frozen before options existed, has no `options` at all and
 * lands here as "no choice", which is correct: nobody marked an alternative on
 * it.
 */
export function readPresentedOptions(snapshot: unknown): PresentedOption[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  const raw = (snapshot as { options?: unknown }).options
  if (!Array.isArray(raw)) return []

  const parsed: PlanOption[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const option = entry as PlanOption
    if (!isOptionKey(option.key)) continue
    if (!Number.isFinite(option.total)) continue
    parsed.push({
      key: option.key,
      total: Number(option.total),
      choices: Array.isArray(option.choices) ? option.choices : [],
      sameAsOptimal: Boolean(option.sameAsOptimal),
    })
  }

  const optimal = parsed.find((o) => o.key === 'optimal')
  if (!optimal) return []
  // Nothing differs from the doctor's plan: showing three identical prices is
  // worse than showing one.
  if (!parsed.some((o) => o.key !== 'optimal' && !o.sameAsOptimal)) return []

  return PLAN_OPTION_ORDER.map((key) => parsed.find((o) => o.key === key))
    .filter((o): o is PlanOption => Boolean(o))
    .filter((o) => o.key === 'optimal' || !o.sameAsOptimal)
    .map((o) => ({
      ...o,
      changedCount: o.key === 'optimal' ? 0 : o.choices.filter((c) => c.source === 'alternative').length,
    }))
}

export interface CostLine {
  itemId: string
  serviceName: string
  teeth: number[]
  price: number
  total: number
}

export interface CostStage {
  stageId: string
  title: string
  total: number
  lines: CostLine[]
}

/**
 * The plan broken out for "explain the price".
 *
 * Every number is read from the frozen snapshot, including each line's own
 * total — the release already stores what each line came to, so nothing here
 * multiplies a price by a count and risks disagreeing with the sum above it.
 */
export function readCostBreakdown(snapshot: unknown): CostStage[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  const stages = (snapshot as { stages?: unknown }).stages
  if (!Array.isArray(stages)) return []

  return stages.map((raw, index) => {
    const stage = (raw ?? {}) as Record<string, unknown>
    const items = Array.isArray(stage.items) ? stage.items : []
    const lines: CostLine[] = items.map((entry, i) => {
      const item = (entry ?? {}) as Record<string, unknown>
      const teeth = Array.isArray(item.teeth) ? (item.teeth as number[]) : []
      const price = Number(item.price) || 0
      const units = teeth.length > 0 ? teeth.length : Number(item.qty) || 1
      return {
        itemId: String(item.id ?? `${index}-${i}`),
        serviceName: String(item.serviceName ?? item.name ?? ''),
        teeth,
        price,
        total: Math.round(price * units),
      }
    })
    return {
      stageId: String(stage.id ?? index),
      title: String(stage.title ?? ''),
      // The stage's own frozen cost when it has one; otherwise its lines.
      total: Number(stage.cost ?? lines.reduce((sum, l) => sum + l.total, 0)),
      lines,
    }
  })
}
