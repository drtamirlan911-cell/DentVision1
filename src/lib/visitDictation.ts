import type { SurfaceKey, ToothStatusKey } from './odontogram'

/**
 * Free-text visit dictation → structured findings.
 *
 * A dentist finishes a visit and then re-enters what just happened three
 * times: clicking the odontogram, typing the visit note, assembling the plan.
 * They already said it out loud once. This turns that one sentence into the
 * three structured writes, and shows which words produced each one so the
 * doctor can check the machine rather than trust it.
 *
 * Deterministic on purpose — no model call. Dental dictation is formulaic
 * ("на 16 глубокий кариес, жевательная, поставил композит"), so a vocabulary
 * and a clause walk get it right, cost nothing, work offline, and give the
 * same answer twice. `lib/triage.ts` and the insight rules take the same line.
 *
 * What it deliberately does not do: guess. A tooth it cannot resolve to a
 * quadrant, or a clinical term with no tooth attached, goes to `unresolved`
 * rather than into a finding — a chart mark the doctor did not intend is far
 * worse than one they have to enter by hand.
 */

/** Where in the original text an interpretation came from. */
export interface DictationSpan {
  start: number
  end: number
  text: string
}

/**
 * `observed` — the state the tooth is in now, safe to stamp on the chart.
 * `planned` — what the doctor said should happen ("рекомендую коронку"),
 * which belongs in the treatment plan and must never touch the chart.
 */
export type FindingKind = 'observed' | 'planned'

export interface ToothFinding {
  /** FDI number. */
  tooth: number
  status: ToothStatusKey
  /** Surfaces named alongside the status, empty when the whole tooth is meant. */
  surfaces: SurfaceKey[]
  kind: FindingKind
  /** The clause this came from, for highlighting the source text. */
  span: DictationSpan
}

export type UnresolvedReason =
  | 'tooth_without_finding'
  | 'finding_without_tooth'
  | 'ambiguous_tooth'

export interface UnresolvedSpan {
  reason: UnresolvedReason
  span: DictationSpan
}

export interface DictationFields {
  complaints: string
  anamnesis: string
  diagnosis: string
  treatment: string
  notes: string
}

export interface DictationDraft {
  findings: ToothFinding[]
  fields: DictationFields
  unresolved: UnresolvedSpan[]
}

/* ── vocabulary ─────────────────────────────────────────────────────────── */

/**
 * Clinical state, most specific first.
 *
 * Order carries meaning: "кариес … поставил пломбу" is one tooth in one end
 * state, and that state is the restoration, not the caries it replaced. So
 * `filled` is tested before `caries` and wins the clause.
 */
const STATUS_PATTERNS: Array<[ToothStatusKey, RegExp]> = [
  ['endo_fail', /перелеч|распломбир|неудачн[а-я]*\s+(?:эндо|канал)|эндо[а-я]*\s+неудач/],
  ['endo_ok', /эндодонт|депульпир|пульпэктом|канал[а-я]*\s+(?:пролеч|запломбир|пломбир)|(?:^|[^а-я])эндо(?![а-я])/],
  ['implant', /имплант/],
  ['veneer', /винир/],
  ['crown', /коронк|коронок/],
  ['extracted', /удал[её]н|удалени|удалил|экстракц/],
  ['missing', /отсутств|адентия|нет зуба/],
  ['fracture', /трещин|скол(?![а-я])|перелом|фрактур/],
  ['inflammation', /воспален|пульпит|периодонтит|гингивит|периостит|периимплантит/],
  ['root', /корнев[а-я]*\s+остат|остат[а-я]*\s+корн|только корень/],
  ['filled', /пломб|реставрац|композит|восстановил|запломбир/],
  ['caries', /кариес|кариозн/],
  ['healthy', /здоров|интактн|санирован/],
]

/** Statuses that make sense on a single surface rather than the whole tooth. */
const SURFACE_CAPABLE = new Set<ToothStatusKey>(['caries', 'filled', 'healthy'])

const SURFACE_PATTERNS: Array<[SurfaceKey, RegExp]> = [
  ['O', /жевательн|окклюзионн|окклюзальн|жеват(?![а-я])/],
  ['M', /медиальн|мезиальн|(?:^|[^а-я])мед(?![а-я])/],
  ['D', /дистальн|(?:^|[^а-я])дист(?![а-я])/],
  ['B', /вестибулярн|вестибуляр|щечн|губн|буккальн/],
  ['L', /н[её]бн|язычн|лингвальн|оральн|палатин/],
]

/** Colloquial tooth name → position inside its quadrant. */
const POSITION_PATTERNS: Array<[number, RegExp]> = [
  [8, /восьм[её]рк|зуб[а-я]*\s+мудрост|трет[а-я]*\s+моляр/],
  [7, /сем[её]рк|втор[а-я]*\s+моляр/],
  [6, /шест[её]рк|перв[а-я]*\s+моляр/],
  [5, /пят[её]рк|втор[а-я]*\s+премоляр/],
  [4, /четв[её]рк|перв[а-я]*\s+премоляр/],
  [3, /тро[её]чк|тройк|клык/],
  [2, /дво[её]чк|двойк|боков[а-я]*\s+резец/],
  [1, /единичк|единиц|центральн[а-я]*\s+резец/],
]

const UPPER_HINT = /верхн|сверху|вверху|(?:^|[^а-я])вч(?![а-я])/
const LOWER_HINT = /нижн|снизу|внизу|(?:^|[^а-я])нч(?![а-я])/
const RIGHT_HINT = /справа|правы|правой|правом|прав(?![а-я])/
const LEFT_HINT = /слева|левы|левой|левом|лев(?![а-я])/

/**
 * Words that turn what follows into an intention rather than an observation.
 * Without this "на 26 трещина, рекомендую коронку" would stamp a crown on a
 * tooth that does not have one.
 */
const PLAN_MARKER = /рекоменд|планир|нужн|требуетс|показан|предлага|назнач|в план|следующ[а-я]+\s+(?:раз|визит|при[её]м)/

/** A two-digit number next to one of these is a quantity, not a tooth. */
const UNIT_AFTER = /^\s*(?:лет|год|года|мм|мл|см|%|процент|тыс|тысяч|тенге|₸|раз|дн|дней|день|недел|месяц|минут|час)/

/* ── helpers ────────────────────────────────────────────────────────────── */

/** Lowercase + ё→е. Both are 1:1, so offsets still index the original text. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е')
}

/** FDI validity: quadrants 1-4 hold positions 1-8, primary quadrants 5-8 hold 1-5. */
export function isValidFdi(n: number): boolean {
  const q = Math.floor(n / 10)
  const p = n % 10
  if (p < 1) return false
  if (q >= 1 && q <= 4) return p <= 8
  if (q >= 5 && q <= 8) return p <= 5
  return false
}

function firstMatch<T>(patterns: Array<[T, RegExp]>, haystack: string): { value: T; index: number } | null {
  for (const [value, re] of patterns) {
    const m = re.exec(haystack)
    if (m) return { value, index: m.index }
  }
  return null
}

function allMatches<T>(patterns: Array<[T, RegExp]>, haystack: string): T[] {
  const out: T[] = []
  for (const [value, re] of patterns) {
    if (re.test(haystack)) out.push(value)
  }
  return out
}

interface ToothMention {
  tooth: number | null
  /** Set when a colloquial name resolved to a position but not to a quadrant. */
  ambiguous: boolean
  start: number
  end: number
}

/**
 * Every tooth reference in a segment, in reading order.
 *
 * Two forms are accepted because dentists use both: the written number ("16")
 * and the spoken name ("шестёрка сверху справа"). The spoken form needs an
 * arch and a side to become an FDI number; a name without them is reported as
 * ambiguous instead of being guessed at.
 */
function findToothMentions(segment: string, offset: number): ToothMention[] {
  const mentions: ToothMention[] = []

  const numeric = /\b([1-8][1-8])\b/g
  let m: RegExpExecArray | null
  while ((m = numeric.exec(segment)) !== null) {
    const n = Number(m[1])
    if (!isValidFdi(n)) continue
    if (UNIT_AFTER.test(segment.slice(m.index + m[0].length))) continue
    mentions.push({ tooth: n, ambiguous: false, start: offset + m.index, end: offset + m.index + m[0].length })
  }

  for (const [position, re] of POSITION_PATTERNS) {
    const global = new RegExp(re.source, 'g')
    while ((m = global.exec(segment)) !== null) {
      // Arch and side may sit either side of the name ("верхняя шестёрка
      // справа"), so the whole segment is the context, not just what follows.
      const upper = UPPER_HINT.test(segment)
      const lower = LOWER_HINT.test(segment)
      const right = RIGHT_HINT.test(segment)
      const left = LEFT_HINT.test(segment)
      const start = offset + m.index
      const end = start + m[0].length
      if (upper === lower || right === left) {
        mentions.push({ tooth: null, ambiguous: true, start, end })
        continue
      }
      const quadrant = upper ? (right ? 1 : 2) : (left ? 3 : 4)
      mentions.push({ tooth: quadrant * 10 + position, ambiguous: false, start, end })
    }
  }

  mentions.sort((a, b) => a.start - b.start)
  return mentions
}

interface Segment {
  /** Absolute offsets into the original text. */
  start: number
  end: number
}

function splitOn(text: string, start: number, end: number, re: RegExp): Segment[] {
  const out: Segment[] = []
  const slice = text.slice(start, end)
  const global = new RegExp(re.source, 'g')
  let from = 0
  let m: RegExpExecArray | null
  while ((m = global.exec(slice)) !== null) {
    out.push({ start: start + from, end: start + m.index })
    from = m.index + m[0].length
  }
  out.push({ start: start + from, end })
  return out.filter((s) => text.slice(s.start, s.end).trim().length > 0)
}

/** Sentences. A comma is not a boundary here — it usually joins one finding. */
function splitSentences(text: string): Segment[] {
  return splitOn(text, 0, text.length, /[.;!?\n]+/)
}

/**
 * Sentence → one unit per tooth being talked about.
 *
 * Positional splitting ("everything up to the next tooth belongs to this one")
 * looks obvious and is wrong, because Russian puts the tooth on either side of
 * the finding: «на 16 кариес» but also «кариес на 16». Splitting on commas and
 * «и» first gives each finding its own clause regardless of word order, and a
 * clause with no tooth of its own (« жевательная», « медиальная») folds back
 * into the one before it.
 */
function unitsForSentence(text: string, sentence: Segment, mentions: ToothMention[]): Segment[] {
  const resolved = mentions.filter((x) => x.tooth !== null)
  if (resolved.length <= 1) return [sentence]

  const clauses = splitOn(text, sentence.start, sentence.end, /,|\sи\s/)
  const units: Segment[] = []
  for (const clause of clauses) {
    const owns = resolved.some((x) => x.start >= clause.start && x.start < clause.end)
    if (owns || units.length === 0) {
      units.push({ ...clause })
    } else {
      // No tooth here: it qualifies the previous clause rather than starting a
      // new finding. Extending the previous unit keeps offsets contiguous.
      units[units.length - 1].end = clause.end
    }
  }
  // Anything said before the first tooth is part of that first finding.
  if (units.length > 0) units[0].start = sentence.start
  return units
}

function span(text: string, start: number, end: number): DictationSpan {
  return { start, end, text: text.slice(start, end).trim() }
}

/* ── field routing ──────────────────────────────────────────────────────── */

const COMPLAINT_MARKER = /жалоб|жалует|беспокоит|обратил[а-я]*\s+с|болит|боли(?![а-я])|ноет/
const ANAMNESIS_MARKER = /анамнез|со слов|ранее лечил|перенес|аллерги|хроническ/
const ACTION_MARKER = /провед|выполн|поставил|сделал|запломбир|наложил|обработал|препарир|анестези|снял|зафиксир|удалил|лечени/

type FieldKey = keyof DictationFields

/** One sentence → one visit field. Rules stay one-liners so each is testable. */
function routeSegment(normalized: string, hasFinding: boolean): FieldKey {
  if (COMPLAINT_MARKER.test(normalized)) return 'complaints'
  if (ANAMNESIS_MARKER.test(normalized)) return 'anamnesis'
  if (ACTION_MARKER.test(normalized)) return 'treatment'
  if (hasFinding) return 'diagnosis'
  return 'notes'
}

/* ── main ───────────────────────────────────────────────────────────────── */

/**
 * Collapse repeats.
 *
 * A tooth named again later in the dictation is the same tooth further along
 * («на 16 кариес… поставил пломбу на 16»), so the last observation is the one
 * that stands — but the surfaces named earlier still describe where the work
 * was, and are carried forward when the later clause does not repeat them.
 */
function dedupeFindings(findings: ToothFinding[]): ToothFinding[] {
  const observed = new Map<number, ToothFinding>()
  const planned = new Map<string, ToothFinding>()
  const order: Array<{ kind: FindingKind; key: string | number }> = []

  for (const f of findings) {
    if (f.kind === 'observed') {
      const prev = observed.get(f.tooth)
      if (!prev) order.push({ kind: 'observed', key: f.tooth })
      observed.set(f.tooth, {
        ...f,
        surfaces: f.surfaces.length ? f.surfaces : (prev?.surfaces ?? []),
      })
    } else {
      const key = `${f.tooth}:${f.status}`
      if (!planned.has(key)) order.push({ kind: 'planned', key })
      planned.set(key, f)
    }
  }

  return order.map((o) =>
    o.kind === 'observed' ? (observed.get(o.key as number) as ToothFinding) : (planned.get(o.key as string) as ToothFinding),
  )
}

export function parseDictation(raw: string): DictationDraft {
  const text = raw || ''
  const norm = normalize(text)
  const findings: ToothFinding[] = []
  const unresolved: UnresolvedSpan[] = []
  const buckets: Record<FieldKey, string[]> = {
    complaints: [], anamnesis: [], diagnosis: [], treatment: [], notes: [],
  }

  for (const sentence of splitSentences(text)) {
    const sentNorm = norm.slice(sentence.start, sentence.end)
    const mentions = findToothMentions(sentNorm, sentence.start)
    const resolved = mentions.filter((x) => x.tooth !== null)

    for (const ambiguous of mentions.filter((x) => x.ambiguous)) {
      unresolved.push({ reason: 'ambiguous_tooth', span: span(text, ambiguous.start, ambiguous.end) })
    }

    let producedFinding = false

    if (resolved.length === 0) {
      // A clinical word with nothing to attach it to is surfaced, not dropped:
      // it usually means the doctor named the tooth in a way we do not read.
      if (firstMatch(STATUS_PATTERNS, sentNorm)) {
        unresolved.push({ reason: 'finding_without_tooth', span: span(text, sentence.start, sentence.end) })
      }
    } else {
      const sentenceStatus = firstMatch(STATUS_PATTERNS, sentNorm)
      const sentenceSurfaces = allMatches(SURFACE_PATTERNS, sentNorm)

      for (const unit of unitsForSentence(text, sentence, mentions)) {
        const teeth = resolved.filter((x) => x.start >= unit.start && x.start < unit.end).map((x) => x.tooth as number)
        if (teeth.length === 0) continue

        const unitNorm = norm.slice(unit.start, unit.end)
        const owned = span(text, unit.start, unit.end)

        const planAt = PLAN_MARKER.exec(unitNorm)
        const observedPart = planAt ? unitNorm.slice(0, planAt.index) : unitNorm
        const plannedPart = planAt ? unitNorm.slice(planAt.index) : ''

        let observed = firstMatch(STATUS_PATTERNS, observedPart)
        const planned = plannedPart ? firstMatch(STATUS_PATTERNS, plannedPart) : null
        let surfaces = allMatches(SURFACE_PATTERNS, observedPart)

        // An enumerated tooth carries no verb of its own («на 16 и 26
        // коронки»): the sentence supplies what the clause left out.
        if (!observed && !planned && sentenceStatus) {
          observed = sentenceStatus
          if (surfaces.length === 0) surfaces = sentenceSurfaces
        }

        if (!observed && !planned) {
          unresolved.push({ reason: 'tooth_without_finding', span: owned })
          continue
        }

        for (const tooth of teeth) {
          if (observed) {
            findings.push({
              tooth,
              status: observed.value,
              surfaces: SURFACE_CAPABLE.has(observed.value) ? surfaces : [],
              kind: 'observed',
              span: owned,
            })
            producedFinding = true
          }
          if (planned) {
            findings.push({ tooth, status: planned.value, surfaces: [], kind: 'planned', span: owned })
            producedFinding = true
          }
        }
      }
    }

    buckets[routeSegment(sentNorm, producedFinding)].push(text.slice(sentence.start, sentence.end).trim())
  }

  return {
    findings: dedupeFindings(findings),
    fields: {
      complaints: buckets.complaints.join('. '),
      anamnesis: buckets.anamnesis.join('. '),
      diagnosis: buckets.diagnosis.join('. '),
      treatment: buckets.treatment.join('. '),
      notes: buckets.notes.join('. '),
    },
    unresolved,
  }
}
