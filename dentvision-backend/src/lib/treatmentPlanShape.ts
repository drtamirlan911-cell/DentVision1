/**
 * The one canonical shape of `TreatmentPlan.items`, and the one arithmetic over it.
 *
 * `TreatmentPlan` keeps everything structural — diagnosis, stages, line items,
 * teeth, doctorId — inside the `items` JSON column rather than in columns, to
 * avoid migrating a production table (see crm.routes.ts). That is a deliberate
 * trade, but it left three writers producing three different shapes:
 *
 *   - crm.routes.ts        → `{ diagnosis, totalBudget, teeth, stages, doctorId }`
 *   - medical.routes.ts    → whatever the request body contained, verbatim
 *   - ai/agents/doctor.agent.ts → a flat array of line items, `[{ price }]`
 *
 * A reader expecting `items.stages` finds nothing in the last two, so a plan
 * carrying real money silently reads as zero stages and a total of zero.
 * `normalizePlanItems()` accepts all three and returns the canonical one, so
 * every reader agrees on what a plan says regardless of who wrote it.
 */

import { uid } from './helpers.js';

/**
 * How soon the clinician placed the work behind a line item.
 *
 * Same vocabulary `buildPlanFromOdontogram` already emits — a second triage
 * scale would be a machine clinical judgement competing with the first.
 */
export type FindingUrgency = 'high' | 'medium' | 'low';

/**
 * The clinical finding that motivated a line item.
 *
 * Recorded on the line rather than derived later, because the consequences the
 * patient is shown may only quote a library entry for a finding that is *really
 * in the plan*. Without this the presentation would have to guess a diagnosis
 * from a service name, which is exactly the kind of invention this layer exists
 * to prevent. Absent on plans typed by hand — those simply get no consequences
 * act, which is the correct outcome rather than a degraded one.
 */
export interface TreatmentPlanFinding {
  /** Odontogram tooth status, e.g. 'caries', 'root', 'endo_fail', 'missing'. */
  status: string;
  urgency: FindingUrgency;
}

export type AlternativeTier = 'essential' | 'premium';

/**
 * Another service from the clinic's own price list that could stand in for this
 * line — a metal-ceramic crown where the plan says zirconia, or the reverse.
 *
 * The doctor marks these; the three option levels are assembled from them
 * deterministically. `price` comes from the price list, never from a guess.
 */
export interface TreatmentPlanAlternative {
  serviceId: string;
  serviceName: string;
  price: number;
  tier: AlternativeTier;
}

export interface TreatmentPlanLineItem {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  name?: string;
  price?: number;
  teeth?: number[];
  qty?: number;
  finding?: TreatmentPlanFinding;
  alternatives?: TreatmentPlanAlternative[];
  /** The doctor's own choice for this line — what "Optimal" is made of. */
  recommended?: boolean;
}

export const CONSULTATION_PRIORITIES = [
  'aesthetics',
  'fewer_visits',
  'lowest_cost',
  'speed',
  'comfort',
  'longevity',
] as const;

export type ConsultationPriority = (typeof CONSULTATION_PRIORITIES)[number];

/** What mattered to this patient in the chair, in the doctor's own words. */
export interface TreatmentPlanConsultation {
  priorities: ConsultationPriority[];
  /** ≤300 characters. Never regenerated — quoted or omitted. */
  note?: string;
}

export interface TreatmentPlanStage {
  id?: string;
  title: string;
  status?: string;
  sortOrder?: number;
  cost?: number | null;
  items?: TreatmentPlanLineItem[];
  notes?: string;
}

export interface TreatmentPlanItems {
  diagnosis?: string | null;
  totalBudget?: number | null;
  teeth?: number[];
  stages?: TreatmentPlanStage[];
  doctorId?: string | null;
  consultation?: TreatmentPlanConsultation;
}

export const MAX_CONSULTATION_NOTE_CHARS = 300;

/** Keep only the priorities we know, and clamp the doctor's note. */
export function normalizeConsultation(raw: unknown): TreatmentPlanConsultation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as TreatmentPlanConsultation;
  const priorities = (Array.isArray(value.priorities) ? value.priorities : []).filter(
    (p): p is ConsultationPriority => (CONSULTATION_PRIORITIES as readonly string[]).includes(String(p)),
  );
  const note = typeof value.note === 'string' ? value.note.trim().slice(0, MAX_CONSULTATION_NOTE_CHARS) : '';
  if (priorities.length === 0 && !note) return undefined;
  return note ? { priorities, note } : { priorities };
}

function normalizeFinding(raw: unknown): TreatmentPlanFinding | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as TreatmentPlanFinding;
  const status = String(value.status || '').trim();
  const urgency = String(value.urgency || '');
  if (!status) return undefined;
  if (!['high', 'medium', 'low'].includes(urgency)) return undefined;
  return { status, urgency: urgency as FindingUrgency };
}

/**
 * Drop anything that is not a usable alternative.
 *
 * A tier we do not know, a missing name or a price that is not a positive
 * number would each end up on screen as an option the patient could choose, so
 * they are discarded here rather than rendered.
 */
function normalizeAlternatives(raw: unknown): TreatmentPlanAlternative[] {
  if (!Array.isArray(raw)) return [];
  const out: TreatmentPlanAlternative[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const alt = entry as TreatmentPlanAlternative;
    const tier = String(alt.tier || '');
    const serviceName = String(alt.serviceName || '').trim();
    const price = Number(alt.price);
    if (tier !== 'essential' && tier !== 'premium') continue;
    if (!serviceName || !Number.isFinite(price) || price <= 0) continue;
    const serviceId = String(alt.serviceId || '').trim();
    const key = `${tier}:${serviceId || serviceName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ serviceId, serviceName, price: Math.round(price), tier });
  }
  return out;
}

/**
 * Teeth win over `qty`: a crown priced per unit applied to three teeth costs
 * three crowns, and the editor records that as three teeth rather than qty 3.
 * Mirrored in `src/lib/treatment-plan.ts::lineItemTotal` — the two are asserted
 * to agree in treatmentPlanShape.test.ts.
 */
export function lineItemTotal(item: TreatmentPlanLineItem): number {
  const teeth = Array.isArray(item.teeth) ? item.teeth : [];
  const units = teeth.length > 0 ? teeth.length : (Number(item.qty) || 1);
  return Math.round((Number(item.price) || 0) * units);
}

/** A stage's own `cost` is only a fallback for stages that carry no line items. */
export function stageTotal(stage: TreatmentPlanStage): number {
  if (Array.isArray(stage.items) && stage.items.length > 0) {
    return stage.items.reduce((sum, item) => sum + lineItemTotal(item), 0);
  }
  return Number(stage.cost) || 0;
}

export function planTotal(stages: TreatmentPlanStage[]): number {
  return stages.reduce((sum, stage) => sum + stageTotal(stage), 0);
}

/** Fills in ids, ordering and per-stage costs so downstream readers can assume them. */
export function enrichStages(stages: TreatmentPlanStage[] = []): TreatmentPlanStage[] {
  return stages.map((stage, index) => ({
    ...stage,
    id: stage.id || uid(),
    sortOrder: stage.sortOrder ?? index + 1,
    items: Array.isArray(stage.items)
      ? stage.items.map((item) => {
          const finding = normalizeFinding(item.finding);
          const alternatives = normalizeAlternatives(item.alternatives);
          return {
            ...item,
            id: item.id || uid(),
            serviceName: item.serviceName || item.name || 'Услуга',
            teeth: Array.isArray(item.teeth) ? item.teeth : [],
            qty: Number(item.qty) || 1,
            price: Number(item.price) || 0,
            // Assigned unconditionally, not spread in only when present: the
            // `...item` above already carries the *raw* values, so anything
            // normalisation rejected would survive by the back door. Explicit
            // `undefined` also drops out of the canonical JSON the release hash
            // is built from, so a rejected alternative changes no hash.
            finding,
            alternatives: alternatives.length ? alternatives : undefined,
          };
        })
      : [],
    cost: stageTotal({
      ...stage,
      items: Array.isArray(stage.items) ? stage.items : [],
    }),
  }));
}

export function collectPlanTeeth(stages: TreatmentPlanStage[]): number[] {
  const set = new Set<number>();
  for (const stage of stages) {
    for (const item of stage.items || []) {
      for (const tooth of item.teeth || []) set.add(tooth);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Accepts any of the three shapes on record and returns the canonical one.
 * `stages` is always an array afterwards, so callers never have to guard it.
 */
export function normalizePlanItems(raw: unknown): TreatmentPlanItems {
  // A bare array is a flat list of line items with no stage around them —
  // what medical.routes.ts and doctor.agent.ts write. Wrap it in one stage
  // rather than dropping it, which is what reading `.stages` off an array did.
  if (Array.isArray(raw)) {
    return { stages: [{ title: 'План лечения', items: raw as TreatmentPlanLineItem[] }] };
  }
  if (!raw || typeof raw !== 'object') return { stages: [] };

  const items = raw as TreatmentPlanItems;
  const consultation = normalizeConsultation(items.consultation);
  return {
    ...items,
    stages: Array.isArray(items.stages) ? items.stages : [],
    ...(consultation ? { consultation } : { consultation: undefined }),
  };
}

/** Every distinct finding the plan actually records, in stage order. */
export function collectPlanFindings(
  stages: TreatmentPlanStage[],
): Array<{ finding: TreatmentPlanFinding; teeth: number[] }> {
  const byKey = new Map<string, { finding: TreatmentPlanFinding; teeth: Set<number> }>();
  for (const stage of stages) {
    for (const item of stage.items || []) {
      if (!item.finding) continue;
      const key = `${item.finding.status}:${item.finding.urgency}`;
      const entry = byKey.get(key) ?? { finding: item.finding, teeth: new Set<number>() };
      for (const tooth of item.teeth || []) entry.teeth.add(tooth);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].map((e) => ({
    finding: e.finding,
    teeth: [...e.teeth].sort((a, b) => a - b),
  }));
}

/**
 * Statuses a patient may see in their own portal.
 *
 * `draft` and `proposed` are both excluded, and `proposed` is the important one:
 * it looks like "the doctor offered this", but it is also what
 * `src/lib/odontogram-plan-sync.ts` stamps on the plan it generates
 * *automatically* on every dental-chart save. Those carry machine-estimated
 * prices and a machine-written diagnosis that no clinician has looked at yet.
 *
 * This is a status-based approximation. Phase 1 replaces it with an explicit
 * publication record (`TreatmentPlanRelease.publishedAt`), at which point the
 * patient sees a frozen snapshot a named doctor signed off on, and this list
 * stops being the gate.
 */
export const PATIENT_VISIBLE_PLAN_STATUSES = [
  'active',
  'accepted',
  'in_progress',
  'completed',
] as const;

export function isPatientVisiblePlanStatus(status: unknown): boolean {
  return (PATIENT_VISIBLE_PLAN_STATUSES as readonly string[]).includes(String(status));
}
