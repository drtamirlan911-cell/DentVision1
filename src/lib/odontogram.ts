/** Shared odontogram model: statuses, surfaces, AI/plan helpers. */

export const SURFACE_KEYS = ['M', 'O', 'D', 'B', 'L'] as const
export type SurfaceKey = (typeof SURFACE_KEYS)[number]

/** Whole-tooth statuses (apply to the tooth as a unit). */
export const WHOLE_TOOTH_STATUSES = [
  'healthy',
  'crown',
  'missing',
  'extracted',
  'root',
  'implant',
  'veneer',
  'fracture',
  'inflammation',
  'endo_ok',
  'endo_fail',
] as const

/** Surface-level statuses (paint on MODBL). */
export const SURFACE_STATUSES = ['caries', 'filled', 'healthy'] as const

/**
 * Permanent dentition, chart order (patient-facing: right quadrant first).
 * Re-exported from the odontogram model so a chart does not have to reach into
 * seed data for the thing it is a chart *of*.
 */
export const UPPER_PERMANENT = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const
export const LOWER_PERMANENT = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const

/** Primary (deciduous) dentition — 10 per arch, same right-first order. */
export const UPPER_PRIMARY = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65] as const
export const LOWER_PRIMARY = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] as const

export type Dentition = 'permanent' | 'primary'

export function archTeeth(dentition: Dentition, upper: boolean): readonly number[] {
  if (dentition === 'primary') return upper ? UPPER_PRIMARY : LOWER_PRIMARY
  return upper ? UPPER_PERMANENT : LOWER_PERMANENT
}

export type ToothStatusKey =
  | (typeof WHOLE_TOOTH_STATUSES)[number]
  | (typeof SURFACE_STATUSES)[number]
  | 'caries'
  | 'filled'
  | string

export type ToothSurfaces = Partial<Record<SurfaceKey, ToothStatusKey | string>>

export interface ToothData {
  status?: ToothStatusKey
  surfaces?: ToothSurfaces
  diagnosis?: string | null
  notes?: string | null
}

export type PatientTeeth = Record<string | number, string | ToothData>

/**
 * Clinical status palette.
 *
 * These are the marks a dentist reads at a glance, so they follow the
 * conventional chart vocabulary rather than a decorative ramp: caries red,
 * a restoration graphite, a crown blue, an implant green. `healthy` stays the
 * green it has always been — nothing is drawn for it, it only labels the
 * "clear this tooth" control.
 *
 * Deliberately *not* theme tokens: a chart mark means the same thing on a
 * light and a dark surface, and a token that flips with the theme would make
 * "red" stop meaning caries. The design-token guard permits this — it governs
 * `className` and inline `style`, and these values reach SVG paint attributes.
 */
export const STATUS_META: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Здоров', color: '#27AE60' },
  caries: { label: 'Кариес', color: '#E5484D' },
  filled: { label: 'Пломба', color: '#33383F' },
  crown: { label: 'Коронка', color: '#3B82F6' },
  implant: { label: 'Имплант', color: '#0EA371' },
  missing: { label: 'Отсутствует', color: '#94A3B8' },
  extracted: { label: 'Удалён', color: '#64748B' },
  fracture: { label: 'Трещина', color: '#E5484D' },
  inflammation: { label: 'Воспаление', color: '#F43F5E' },
  root: { label: 'Корень', color: '#E67E22' },
  veneer: { label: 'Винир', color: '#E91E8C' },
  endo_ok: { label: 'Эндо ✓', color: '#2ECC71' },
  endo_fail: { label: 'Эндо ✗', color: '#C0392B' },
}

/**
 * Hex → status, for teeth saved before statuses had names.
 *
 * Early charts stored the swatch itself (`{ O: '#F39C12' }`) rather than a key,
 * and those rows are still in patients' records. The reverse lookup used to
 * walk STATUS_META, which worked only while the palette never moved — the
 * moment it did, every legacy tooth silently stopped resolving and rendered as
 * an unknown colour with no label. Pinning the old values here decouples "what
 * a stored hex meant" from "what we paint today", so the palette can change
 * again without taking historical data with it.
 */
const LEGACY_STATUS_HEX: Record<string, string> = {
  '#27ae60': 'healthy',
  '#f39c12': 'caries',
  '#2980b9': 'filled',
  '#8e44ad': 'crown',
  '#e74c3c': 'missing',
  '#e67e22': 'root',
  '#00bcd4': 'implant',
  '#e91e8c': 'veneer',
  '#2ecc71': 'endo_ok',
  '#c0392b': 'endo_fail',
}

/** Status key for a stored value, whether it is a key or any-era hex. */
function statusKeyOf(value: string): string | undefined {
  if (STATUS_META[value]) return value
  const lower = value.toLowerCase()
  for (const [key, meta] of Object.entries(STATUS_META)) {
    if (meta.color.toLowerCase() === lower) return key
  }
  return LEGACY_STATUS_HEX[lower]
}

/** Resolve color whether value is a status key or a legacy hex. */
export function statusColor(value?: string | null): string {
  if (!value) return 'transparent'
  const key = statusKeyOf(value)
  if (key) return STATUS_META[key].color
  if (value.startsWith('#') || value.startsWith('rgb')) return value
  return value
}

export function statusLabel(value?: string | null): string {
  if (!value) return '—'
  const key = statusKeyOf(String(value))
  if (key) return STATUS_META[key].label
  return String(value)
}

/** Normalize surface value (hex or key) → status key when possible. */
export function normalizeSurfaceStatus(value?: string | null): ToothStatusKey | undefined {
  if (!value) return undefined
  return statusKeyOf(value) ?? value
}

export function normalizeTooth(raw: string | ToothData | null | undefined): ToothData {
  if (!raw) return { status: 'healthy', surfaces: {} }
  if (typeof raw === 'string') return { status: raw, surfaces: {} }
  const surfaces: ToothSurfaces = {}
  if (raw.surfaces && typeof raw.surfaces === 'object') {
    for (const [k, v] of Object.entries(raw.surfaces)) {
      const key = k as SurfaceKey
      if (!SURFACE_KEYS.includes(key)) continue
      const n = normalizeSurfaceStatus(v)
      if (n && n !== 'healthy') surfaces[key] = n
    }
  }
  return {
    status: raw.status || 'healthy',
    surfaces,
    diagnosis: raw.diagnosis ?? null,
    notes: raw.notes ?? null,
  }
}

export interface PlanRecommendation {
  tooth: string
  procedure: string
  urgency: 'high' | 'medium' | 'low'
  estimatedPrice: number
  reason: string
  /**
   * The odontogram status this recommendation came from.
   *
   * Carried through rather than left behind because the patient presentation
   * may only quote a consequence for a finding the plan actually records — see
   * `consequences.catalog.ts`. Without it the presentation would have to infer
   * a condition from a service name, which is exactly the guessing that layer
   * exists to prevent.
   */
  status: string
}

const SURFACE_RU: Record<SurfaceKey, string> = {
  M: 'М',
  O: 'О',
  D: 'Д',
  B: 'В',
  L: 'Я',
}

/** Rule-based preliminary plan from a filled odontogram (instant, no LLM). */
export function buildPlanFromOdontogram(teeth: PatientTeeth): PlanRecommendation[] {
  const out: PlanRecommendation[] = []

  for (const [num, raw] of Object.entries(teeth || {})) {
    const t = normalizeTooth(raw)
    const status = t.status || 'healthy'
    const surfaces = t.surfaces || {}

    if (status === 'missing') {
      out.push({
        tooth: num,
        procedure: 'Имплантация или ортопедическое восстановление',
        urgency: 'low',
        estimatedPrice: 250000,
        reason: 'Зуб отсутствует',
        status: 'missing',
      })
      continue
    }
    if (status === 'endo_fail') {
      out.push({
        tooth: num,
        procedure: 'Перелечивание каналов / удаление + восстановление',
        urgency: 'high',
        estimatedPrice: 85000,
        reason: 'Неуспешная эндодонтия',
        status: 'endo_fail',
      })
    }
    if (status === 'root') {
      out.push({
        tooth: num,
        procedure: 'Эндодонтия / ортопедия или удаление',
        urgency: 'high',
        estimatedPrice: 45000,
        reason: 'Сохранён корень',
        status: 'root',
      })
    }
    if (status === 'caries') {
      out.push({
        tooth: num,
        procedure: 'Лечение кариеса + реставрация',
        urgency: 'medium',
        estimatedPrice: 18000,
        reason: 'Кариес (зуб)',
        status: 'caries',
      })
    }
    if (status === 'extracted') {
      out.push({
        tooth: num,
        procedure: 'Имплантация или ортопедическое восстановление',
        urgency: 'low',
        estimatedPrice: 250000,
        reason: 'Зуб удалён',
        status: 'extracted',
      })
    }
    if (status === 'fracture') {
      out.push({
        tooth: num,
        procedure: 'Восстановление коронковой части / ортопедия',
        urgency: 'high',
        estimatedPrice: 60000,
        reason: 'Трещина / скол',
        status: 'fracture',
      })
    }
    if (status === 'inflammation') {
      out.push({
        tooth: num,
        procedure: 'Лечение периодонтита / противовоспалительная терапия',
        urgency: 'high',
        estimatedPrice: 55000,
        reason: 'Воспаление',
        status: 'inflammation',
      })
    }

    const cariesSurfaces = SURFACE_KEYS.filter((s) => normalizeSurfaceStatus(surfaces[s]) === 'caries')
    if (cariesSurfaces.length) {
      out.push({
        tooth: num,
        procedure: `Лечение кариеса (${cariesSurfaces.map((s) => SURFACE_RU[s]).join('/')})`,
        urgency: cariesSurfaces.includes('O') && cariesSurfaces.length >= 2 ? 'high' : 'medium',
        estimatedPrice: 12000 + cariesSurfaces.length * 4000,
        reason: `Кариес поверхностей: ${cariesSurfaces.join(', ')}`,
        status: 'caries',
      })
    }

    if (status === 'implant') {
      // informational — usually already restored; skip unless surfaces have issues
    }
  }

  // de-dupe same tooth+procedure
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.tooth}:${r.procedure}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).sort((a, b) => {
    const u = { high: 0, medium: 1, low: 2 }
    return u[a.urgency] - u[b.urgency] || Number(a.tooth) - Number(b.tooth)
  })
}

/** Compact human/AI-readable odontogram summary. */
export function summarizeOdontogram(teeth: PatientTeeth, patientName?: string): string {
  const lines: string[] = []
  if (patientName) lines.push(`Одонтограмма: ${patientName}`)

  const entries = Object.entries(teeth || {})
    .map(([n, raw]) => [n, normalizeTooth(raw)] as const)
    .filter(([, t]) => {
      const hasSurface = Object.keys(t.surfaces || {}).length > 0
      return (t.status && t.status !== 'healthy') || hasSurface
    })
    .sort((a, b) => Number(a[0]) - Number(b[0]))

  if (!entries.length) {
    lines.push('Все зубы без отметок (здоровы / не заполнены).')
    return lines.join('\n')
  }

  for (const [num, t] of entries) {
    const parts: string[] = [`${num}: ${statusLabel(t.status)}`]
    const surf = Object.entries(t.surfaces || {})
      .map(([s, v]) => `${s}=${statusLabel(v)}`)
      .join(', ')
    if (surf) parts.push(`поверхности [${surf}]`)
    lines.push(parts.join(' · '))
  }
  return lines.join('\n')
}

export function aiPlanPrompt(patientId: string, patientName: string, teeth: PatientTeeth): string {
  const summary = summarizeOdontogram(teeth, patientName)
  return (
    `Составь предварительный план лечения по одонтограмме пациента «${patientName}» (id ${patientId}).\n` +
    `Сначала вызови getPatientCard, сверь зубную карту. Затем предложи этапы (FDI, процедуры, ориентир бюджета) ` +
    `и создай черновик через createTreatmentPlan (confirmed=false) для моего подтверждения.\n\n` +
    `Сводка одонтограммы:\n${summary}`
  )
}
