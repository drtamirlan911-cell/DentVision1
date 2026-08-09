/**
 * Referral status vocabulary — one source for labels, tone and pipeline order.
 *
 * This lived as a hardcoded `STATUS_MAP` copied into six files, each mapping a
 * status to an arbitrary hex: `#3498DB`, `#9B59B6`, `#F39C12`, `#C9A96E`,
 * `#27AE60`, `#95A5A6`, `#E74C3C`. Three of those are literally the values of
 * existing tokens, and `#C9A96E` is the brand gold — a status painted in the
 * accent colour. None of them went through the token system, so none followed
 * the light theme.
 *
 * Worse, those copies covered seven statuses while `ReferralStatus` has eleven,
 * and included `RECEIVED`, which is not in the enum at all. The five real
 * statuses nobody mapped fell through to a grey default that printed the raw
 * name — users were shown `PATIENT_ARRIVED`.
 *
 * Colour rules follow from what the value means: the middle stages are an
 * ordered progression, so they take steps of one hue rather than unrelated
 * hues; the reserved status tokens are kept for the terminal good/bad states;
 * and every status ships with a label, so colour is never the only signal.
 */

export type ReferralStatus =
  | 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SCHEDULED' | 'PATIENT_ARRIVED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'DELIVERED' | 'CLOSED' | 'CANCELLED'

/** Maps to the token set in tailwind.config.js — never a raw hex. */
export type StatusTone = 'muted' | 'info' | 'progress' | 'active' | 'success' | 'error'

export interface StatusInfo {
  label: string
  tone: StatusTone
  /** Lifecycle position; CANCELLED sits outside the pipeline. */
  phase: PhaseId | 'cancelled'
}

export const REFERRAL_STATUS: Record<ReferralStatus, StatusInfo> = {
  DRAFT:           { label: 'Черновик',       tone: 'muted',    phase: 'awaiting' },
  SENT:            { label: 'Отправлено',     tone: 'info',     phase: 'awaiting' },
  ACCEPTED:        { label: 'Принято',        tone: 'progress', phase: 'accepted' },
  SCHEDULED:       { label: 'Запланировано',  tone: 'progress', phase: 'accepted' },
  PATIENT_ARRIVED: { label: 'Пациент прибыл', tone: 'active',   phase: 'accepted' },
  IN_PROGRESS:     { label: 'В работе',       tone: 'active',   phase: 'inProgress' },
  COMPLETED:       { label: 'Завершено',      tone: 'success',  phase: 'done' },
  REVIEWED:        { label: 'Просмотрено',    tone: 'success',  phase: 'done' },
  DELIVERED:       { label: 'Выдано',         tone: 'success',  phase: 'done' },
  CLOSED:          { label: 'Закрыто',        tone: 'muted',    phase: 'done' },
  CANCELLED:       { label: 'Отменено',       tone: 'error',    phase: 'cancelled' },
}

/** Tailwind classes per tone. Middle stages are steps of the gold ramp. */
export const TONE_CLASSES: Record<StatusTone, { text: string; bg: string; dot: string }> = {
  // A solid surface step rather than a 10% tint of the muted grey: at that
  // strength a neutral is indistinguishable from the card behind it, so the
  // chip read as no chip. (It also used to compile to nothing at all — see the
  // `themed()` note in tailwind.config.js.)
  muted:    { text: 'text-txt-muted',   bg: 'bg-surface-2',      dot: 'bg-txt-muted' },
  info:     { text: 'text-info',        bg: 'bg-info/10',        dot: 'bg-info' },
  // gold-light → gold is a monotonic light→dark step in BOTH themes; gold-dim
  // (#8B6F3E in either) is darker than gold in light mode, which read the
  // pipeline backwards there.
  progress: { text: 'text-dv-gold-light', bg: 'bg-dv-gold-light/10', dot: 'bg-dv-gold-light' },
  active:   { text: 'text-dv-gold',     bg: 'bg-dv-gold/10',     dot: 'bg-dv-gold' },
  success:  { text: 'text-success',     bg: 'bg-success/10',     dot: 'bg-success' },
  error:    { text: 'text-error',       bg: 'bg-error/10',       dot: 'bg-error' },
}

export type PhaseId = 'awaiting' | 'accepted' | 'inProgress' | 'done'

/**
 * The pipeline, grouped for display.
 *
 * Eleven ordered stages is past the point where separate colours stop helping,
 * so the funnel shows four phases and the exact status stays on each row.
 */
export const PHASES: Array<{ id: PhaseId; label: string; tone: StatusTone }> = [
  { id: 'awaiting',   label: 'Ждут ответа', tone: 'info' },
  { id: 'accepted',   label: 'Приняты',     tone: 'progress' },
  { id: 'inProgress', label: 'В работе',    tone: 'active' },
  { id: 'done',       label: 'Готово',      tone: 'success' },
]

const UNKNOWN: StatusInfo = { label: 'Неизвестно', tone: 'muted', phase: 'awaiting' }

/** Never prints a raw enum name at the user. */
export function statusInfo(status: string | null | undefined): StatusInfo {
  if (!status) return UNKNOWN
  return REFERRAL_STATUS[status as ReferralStatus] ?? { ...UNKNOWN, label: 'Неизвестно' }
}

export function toneClasses(tone: StatusTone) {
  return TONE_CLASSES[tone]
}

/** Counts per pipeline phase, plus cancelled, for the funnel. */
export function countByPhase(
  referrals: Array<{ status?: string | null }>,
): Record<PhaseId | 'cancelled', number> {
  const counts: Record<PhaseId | 'cancelled', number> = {
    awaiting: 0, accepted: 0, inProgress: 0, done: 0, cancelled: 0,
  }
  for (const referral of referrals) counts[statusInfo(referral.status).phase] += 1
  return counts
}

/** What the executing organisation must act on — the number the screen leads with. */
export function countAwaitingAction(referrals: Array<{ status?: string | null }>): number {
  const counts = countByPhase(referrals)
  return counts.awaiting + counts.accepted
}
