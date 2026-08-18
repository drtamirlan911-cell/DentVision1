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

export interface TreatmentPlanLineItem {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  name?: string;
  price?: number;
  teeth?: number[];
  qty?: number;
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
      ? stage.items.map((item) => ({
          ...item,
          id: item.id || uid(),
          serviceName: item.serviceName || item.name || 'Услуга',
          teeth: Array.isArray(item.teeth) ? item.teeth : [],
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
        }))
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
  return {
    ...items,
    stages: Array.isArray(items.stages) ? items.stages : [],
  };
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
